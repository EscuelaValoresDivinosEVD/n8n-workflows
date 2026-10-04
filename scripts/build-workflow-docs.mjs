#!/usr/bin/env node
// Builds the workflow documentation site from the companion .md files.
//
//   node scripts/build-workflow-docs.mjs      (or: npm run build:docs)
//
// Reads every workflows/**/<name>/<name>.md together with its <name>.json and writes
// site/index.html: one static page with a sidebar grouped by area, one view per workflow
// (the rendered .md) and the workflow JSON in a collapsible panel with a copy button.
//
// Markdown is rendered here, at build time. Styling is Tailwind from its CDN plus the small
// stylesheet in scripts/lib/workflow-docs.css; behaviour is scripts/lib/workflow-docs.client.js.
// The output is generated. Edit the workflow files, this script or those two, not the output.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import {
  ROOT, SITE_DIR, SITE_TITLE, findWorkflowFiles, workflowRef, docsRoute, apiRoute, webhookEndpoints,
} from './lib/workflows.mjs';

const LIB = join(dirname(fileURLToPath(import.meta.url)), 'lib');
const TAILWIND_CDN = 'https://cdn.tailwindcss.com?plugins=typography';

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const idSlug = (text) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ----------------------------------------------------------------- workflows

// What starts a workflow, read from its trigger nodes. Shown as badges.
const KINDS = [
  { id: 'webhook', label: 'Webhook', short: 'Hook', test: (n) => n.type === 'n8n-nodes-base.webhook' },
  { id: 'schedule', label: 'Schedule', short: 'Cron', test: (n) => n.type === 'n8n-nodes-base.scheduleTrigger' },
  { id: 'sub', label: 'Sub-workflow', short: 'Sub', test: (n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger' },
  { id: 'error', label: 'Error handler', short: 'Err', test: (n) => n.type === 'n8n-nodes-base.errorTrigger' },
];
const MANUAL = { id: 'manual', label: 'Manual', short: 'Man' };

function workflowKinds(nodes) {
  const enabled = nodes.filter((n) => !n.disabled);
  const kinds = KINDS.filter((kind) => enabled.some(kind.test));
  return kinds.length ? kinds : [MANUAL];
}

// The companion .md has a fixed opening: "# Title", a summary paragraph, then a bullet list
// of facts ("- **Key:** value"). Everything after that is the body.
function splitCompanion(markdown) {
  const lines = markdown.split('\n');
  let i = lines.findIndex((l) => l.startsWith('# '));
  const title = lines[i].slice(2).trim();
  i += 1;
  while (i < lines.length && !lines[i].trim()) i += 1;
  const summary = [];
  while (i < lines.length && lines[i].trim() && !/^[-#>|]/.test(lines[i])) summary.push(lines[i++].trim());
  while (i < lines.length && !lines[i].trim()) i += 1;
  const facts = [];
  while (i < lines.length && lines[i].startsWith('- ')) {
    const m = lines[i].match(/^- \*\*(.+?):\*\*\s*(.*)$/);
    if (!m) break;
    facts.push({ key: m[1], value: m[2] });
    i += 1;
  }
  return { title, summary: summary.join(' '), facts, body: lines.slice(i).join('\n').trim() };
}

function loadWorkflows() {
  return findWorkflowFiles().map((jsonFile) => {
    const ref = workflowRef(jsonFile);
    if (!ref.mdFile) throw new Error(`No companion .md next to ${relative(ROOT, jsonFile)}`);
    const jsonText = readFileSync(jsonFile, 'utf8');
    const workflow = JSON.parse(jsonText);
    const nodes = workflow.nodes ?? [];
    const doc = splitCompanion(readFileSync(ref.mdFile, 'utf8'));
    return {
      ...ref,
      ...doc,
      id: `${ref.area ?? '-'}/${ref.slug}`,
      domId: `${ref.area ?? 'x'}--${ref.slug}`,
      workflow,
      nodeCount: nodes.length,
      jsonBytes: Buffer.byteLength(jsonText),
      kinds: workflowKinds(nodes),
      endpoints: webhookEndpoints(nodes),
      hasDraftNote: /^> \*\*Draft note\.\*\*/m.test(doc.body),
    };
  });
}

// ------------------------------------------------------------------ markdown

// Rendered Markdown, then three touches: section ids on h2 (for the in-page section links),
// a scroll wrapper around tables, and links for `Workflow name` mentions of other workflows.
function renderBody(wf, all) {
  const sections = [];
  let html = marked.parse(wf.body, { gfm: true });

  html = html.replace(/<h2>(.*?)<\/h2>/g, (_, inner) => {
    const id = `${wf.domId}--${idSlug(inner.replace(/<[^>]+>/g, ''))}`;
    sections.push({ id, label: inner.replace(/<[^>]+>/g, '') });
    return `<h2 id="${id}">${inner}</h2>`;
  });

  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

  html = html.replace(/<code>([^<]+)<\/code>/g, (whole, name) => {
    const matches = all.filter((other) => other !== wf && esc(other.title) === name);
    const target = matches.find((other) => other.area === wf.area) ?? (matches.length === 1 ? matches[0] : null);
    return target ? `<a class="wf-link" href="${docsRoute(target)}">${whole}</a>` : whole;
  });

  return { html, sections };
}

const inline = (markdown) => marked.parseInline(markdown, { gfm: true });

// ------------------------------------------------------------------ fragments

const kindBadges = (wf, short = false) =>
  wf.kinds.map((k) => `<span class="kind kind-${k.id}" title="${k.label}">${short ? k.short : k.label}</span>`).join(' ');

const formatBytes = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`);

function sidebar(areas) {
  const groups = areas.map(({ title, workflows }) => `
        <div data-group class="mb-5">
          <h2 class="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">${esc(title)}</h2>
          ${workflows.map((wf) => `
          <a href="${docsRoute(wf)}" data-nav="${wf.id}" data-search="${esc(`${wf.title} ${title} ${wf.kinds.map((k) => k.label).join(' ')}`.toLowerCase())}"
             class="flex items-start justify-between gap-3 px-3 py-1.5 rounded-md text-sm text-neutral-600 hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-100">
            <span>${esc(wf.title)}</span>
            <span class="shrink-0 pt-1 flex gap-1.5">${kindBadges(wf, true)}</span>
          </a>`).join('')}
        </div>`).join('');

  return `
      <aside id="sidebar" class="fixed top-12 bottom-0 left-0 z-30 w-72 overflow-y-auto border-r border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-neutral-950 p-3">
        <label class="relative block mb-3">
          <span class="sr-only">Search workflows</span>
          <input id="search" type="search" placeholder="Search" autocomplete="off"
                 class="w-full rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 pl-3 pr-8 py-1.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          <kbd class="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-black/10 dark:border-white/15 px-1 text-[10px] text-neutral-400">/</kbd>
        </label>
        <a href="#" data-nav="overview" class="block px-3 py-1.5 mb-4 rounded-md text-sm text-neutral-600 hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-100">Overview</a>
        ${groups}
        <p id="search-empty" class="hidden px-3 text-sm text-neutral-500">No workflow matches.</p>
      </aside>`;
}

function overview(areas, workflows) {
  const endpointCount = workflows.reduce((n, wf) => n + wf.endpoints.length, 0);
  const stat = (value, label) => `
            <div class="rounded-lg border border-black/10 dark:border-white/10 px-4 py-3">
              <div class="text-2xl font-semibold tabular-nums">${value}</div>
              <div class="text-sm text-neutral-500 dark:text-neutral-400">${label}</div>
            </div>`;

  return `
        <section data-view="overview" class="hidden max-w-5xl mx-auto px-6 lg:px-10 py-10">
          <p class="text-sm font-medium text-blue-600 dark:text-blue-400">Workflow documentation</p>
          <h1 class="mt-1 text-3xl font-semibold tracking-tight">${esc(SITE_TITLE)} workflows</h1>
          <p class="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
            What each n8n workflow behind EVD's day-to-day automations does, what triggers it, which credentials
            it uses and where it is fragile. Generated from the workflow exports and their companion notes.
            Webhook endpoints are documented in the <a class="text-blue-600 dark:text-blue-400 hover:underline" href="api/">API reference</a>.
          </p>
          <div class="mt-6 grid grid-cols-3 gap-3 max-w-md">
            ${stat(workflows.length, 'workflows')}${stat(areas.length, 'areas')}${stat(endpointCount, 'webhook endpoints')}
          </div>
          ${areas.map(({ title, workflows: list }) => `
          <h2 class="mt-10 mb-3 text-lg font-semibold">${esc(title)} <span class="font-normal text-neutral-400">${list.length}</span></h2>
          <div class="grid gap-3 md:grid-cols-2">
            ${list.map((wf) => `
            <a href="${docsRoute(wf)}" class="group block rounded-lg border border-black/10 dark:border-white/10 p-4 hover:border-blue-500/60 hover:bg-blue-500/[0.03]">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">${esc(wf.title)}</h3>
                <span class="shrink-0 pt-1 flex gap-1.5">${kindBadges(wf, true)}</span>
              </div>
              <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">${inline(wf.summary)}</p>
            </a>`).join('')}
          </div>`).join('')}
        </section>`;
}

function endpointCard(wf, { method, path }) {
  return `
              <a href="api/${apiRoute(wf, method, path)}" class="group block rounded-lg border border-black/10 dark:border-white/10 p-3 hover:border-blue-500/60">
                <div class="flex items-center gap-2 font-mono text-[13px]">
                  <span class="kind kind-webhook">${method}</span>
                  <span class="break-all">${esc(path)}</span>
                </div>
                <div class="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">Open in API reference →</div>
              </a>`;
}

function jsonPanel(wf) {
  return `
              <div data-json-panel data-json-source="json-${wf.domId}" class="rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 text-neutral-200">
                <div class="flex items-center gap-2 pl-1 pr-2 py-1.5">
                  <button type="button" data-json-toggle aria-expanded="false" class="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/5">
                    <svg class="json-chevron h-3.5 w-3.5 shrink-0 text-neutral-400" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5z"/></svg>
                    <span class="truncate font-mono text-xs">${esc(wf.slug)}.json</span>
                    <span class="shrink-0 text-xs text-neutral-500">${wf.nodeCount} nodes · ${formatBytes(wf.jsonBytes)}</span>
                  </button>
                  <button type="button" data-json-copy class="shrink-0 inline-flex items-center gap-1.5 rounded border border-white/10 px-2 py-1 text-xs text-neutral-300 hover:bg-white/10">
                    <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2A1.5 1.5 0 0 0 9 2H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 10h1.5"/></svg>
                    <span data-copy-label>Copy</span>
                  </button>
                </div>
                <div data-json-body class="hidden border-t border-white/10">
                  <pre class="json-code max-h-[70vh] overflow-auto p-3"></pre>
                </div>
              </div>
              <script type="application/json" id="json-${wf.domId}">${JSON.stringify(wf.workflow).replace(/</g, '\\u003c')}</script>`;
}

function workflowView(wf, all) {
  const { html, sections } = renderBody(wf, all);
  const facts = [...wf.facts, { key: 'Source', value: `\`${relative(ROOT, wf.jsonFile)}\`` }];

  return `
        <article data-view="${wf.id}" data-title="${esc(wf.title)}" class="hidden mx-auto max-w-[88rem] px-6 lg:px-10 py-10">
          <header class="max-w-3xl">
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span class="font-medium text-blue-600 dark:text-blue-400">${esc(wf.areaTitle)}</span>
              ${kindBadges(wf)}
              ${wf.hasDraftNote ? '<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Unpublished draft in n8n</span>' : ''}
            </p>
            <h1 class="mt-1 text-3xl font-semibold tracking-tight">${esc(wf.title)}</h1>
            <p class="mt-3 text-lg text-neutral-600 dark:text-neutral-400">${inline(wf.summary)}</p>
          </header>

          <div class="mt-8 flex flex-col gap-10 xl:flex-row xl:items-start">
            <div class="min-w-0 flex-1 xl:max-w-3xl">
              <nav class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Sections">
                ${sections.map((s) => `<a href="#${s.id}" data-scroll-to="${s.id}" class="text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400">${s.label}</a>`).join('\n                ')}
              </nav>
              <div class="doc prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-h2:text-xl prose-h3:text-base prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-black/5 dark:prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:font-medium prose-code:text-[0.85em] prose-table:text-sm">
                ${html}
              </div>
            </div>

            <aside class="w-full space-y-4 xl:sticky xl:top-20 xl:w-[26rem] xl:shrink-0">
              ${wf.endpoints.map((e) => endpointCard(wf, e)).join('')}
              ${jsonPanel(wf)}
              <dl class="rounded-lg border border-black/10 dark:border-white/10 divide-y divide-black/5 dark:divide-white/5 text-sm">
                ${facts.map((f) => `
                <div class="px-3 py-2.5">
                  <dt class="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">${esc(f.key)}</dt>
                  <dd class="doc-fact mt-0.5 break-words text-neutral-700 dark:text-neutral-300 [&_code]:rounded [&_code]:bg-black/5 dark:[&_code]:bg-white/10 [&_code]:px-1 [&_code]:text-[0.85em]">${inline(f.value)}</dd>
                </div>`).join('')}
              </dl>
            </aside>
          </div>
        </article>`;
}

// ---------------------------------------------------------------------- page

function page(areas, workflows) {
  const css = readFileSync(join(LIB, 'workflow-docs.css'), 'utf8');
  const js = readFileSync(join(LIB, 'workflow-docs.client.js'), 'utf8');

  return `<!doctype html>
<!-- Generated by scripts/build-workflow-docs.mjs. Do not edit by hand; run "npm run build". -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Workflows · ${esc(SITE_TITLE)}</title>
    <script>
      // Before first paint: follow the saved choice, else the system setting.
      (function () {
        var saved = null;
        try { saved = localStorage.getItem('theme'); } catch (e) { /* storage unavailable */ }
        var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', dark);
      })();
    </script>
    <script src="${TAILWIND_CDN}"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: { extend: { fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] } } },
      };
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
    <style>
${css}
    </style>
  </head>
  <body class="bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
    <nav class="sticky top-0 z-40 flex h-12 items-center gap-1 border-b border-black/10 bg-white px-4 text-sm font-medium dark:border-white/10 dark:bg-neutral-950">
      <button id="sidebar-toggle" type="button" class="mr-1 rounded-md p-1.5 text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10 lg:hidden" aria-label="Toggle navigation">
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></svg>
      </button>
      <a href="#" class="mr-4 font-semibold">${esc(SITE_TITLE)}</a>
      <a href="./" aria-current="page" class="rounded-md bg-black/5 px-2.5 py-1.5 dark:bg-white/10">Workflows</a>
      <a href="api/" class="rounded-md px-2.5 py-1.5 text-neutral-500 hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100">API reference</a>
      <button id="theme-toggle" type="button" class="ml-auto rounded-md p-1.5 text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Toggle dark mode">
        <svg class="h-5 w-5 dark:hidden" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M16.5 11.5A6.5 6.5 0 0 1 8.5 3.5a6.5 6.5 0 1 0 8 8z"/></svg>
        <svg class="hidden h-5 w-5 dark:block" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="10" r="3.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>
      </button>
    </nav>
${sidebar(areas)}
    <main class="lg:pl-72">
${overview(areas, workflows)}
${workflows.map((wf) => workflowView(wf, workflows)).join('\n')}
    </main>
    <script>
${js}
    </script>
  </body>
</html>
`;
}

// ---------------------------------------------------------------------- main

const workflows = loadWorkflows();
const areas = [...new Set(workflows.map((wf) => wf.areaTitle))]
  .sort((a, b) => a.localeCompare(b))
  .map((title) => ({ title, workflows: workflows.filter((wf) => wf.areaTitle === title).sort((a, b) => a.title.localeCompare(b.title)) }));

mkdirSync(SITE_DIR, { recursive: true });
writeFileSync(join(SITE_DIR, 'index.html'), page(areas, workflows));
console.log(`${relative(ROOT, SITE_DIR)}/: index.html written, ${workflows.length} workflow(s) in ${areas.length} area(s)`);
