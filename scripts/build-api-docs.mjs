#!/usr/bin/env node
// Builds the webhook API reference from the workflow JSON files.
//
//   node scripts/build-api-docs.mjs      (or: npm run build:api)
//
// Reads every workflows/**/<name>/<name>.json, finds its Webhook nodes and writes:
//   site/api/openapi.yaml  - one OpenAPI spec for every webhook endpoint
//   site/api/index.html    - that spec rendered with Scalar (spec embedded in the page)
//
// What comes from where:
//   - path, method, auth, response mode, body field names and types: the workflow .json
//   - workflow name, summary, field descriptions, "Responses" table: the companion .md
// Both output files are generated. Edit the workflow files or this script, not the outputs.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ROOT, API_DIR, SITE_TITLE, titleCase, findWorkflowFiles, workflowRef, docsRoute, webhookEndpoints,
} from './lib/workflows.mjs';

const API_TITLE = 'EVD n8n Webhooks';
const API_VERSION = '1.0.0';
// Port 45333 is what the pinned requests in the n8n exports were sent to. Not re-verified against today's callers.
const SERVER_URL = 'https://auto.evdsky.com:45333/webhook';
const SCALAR_CDN = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';

// How each n8n header-auth credential is sent. The header name lives inside the credential,
// which exports do not include, so it is recorded here by credential name. A webhook whose
// credential is not listed is documented with the generic "headerAuth" scheme.
const AUTH_SCHEMES = {
  'Header Auth Bearer token n8n.workspace': {
    id: 'workspaceBearer',
    scheme: { type: 'http', scheme: 'bearer', description: 'Send `Authorization: Bearer <token>`. n8n credential: `Header Auth Bearer token n8n.workspace`.' },
  },
  'Header Auth n8n.highlevel': {
    id: 'highlevelBearer',
    scheme: { type: 'http', scheme: 'bearer', description: 'Send `Authorization: Bearer <token>`. n8n credential: `Header Auth n8n.highlevel`.' },
  },
  // Same credential (same n8n ID) under its earlier name, still shown on one node.
  'Header Auth account': {
    id: 'highlevelBearer',
    scheme: { type: 'http', scheme: 'bearer', description: 'Send `Authorization: Bearer <token>`. n8n credential: `Header Auth n8n.highlevel`.' },
  },
  'Header Auth new auto@clev.org': {
    id: 'clevWebhookAuth',
    scheme: { type: 'apiKey', in: 'header', name: 'webhook-auth', description: 'Send the secret in the `webhook-auth` header. n8n credential: `Header Auth new auto@clev.org`.' },
  },
};
const GENERIC_AUTH = {
  id: 'headerAuth',
  scheme: { type: 'apiKey', in: 'header', name: 'Authorization', description: 'n8n header auth. The header name and value are held in the n8n credential named on the endpoint; the header name shown here is a placeholder.' },
};

// ------------------------------------------------------------ companion .md

function readCompanion(jsonFile) {
  const mdFile = jsonFile.replace(/\.json$/, '.md');
  if (!existsSync(mdFile)) return { title: null, summary: null, fields: {}, responses: null, mdFile: null };
  const lines = readFileSync(mdFile, 'utf8').split('\n');

  const title = (lines.find((l) => l.startsWith('# ')) ?? '').slice(2).trim() || null;

  // Summary: the first plain paragraph after the title.
  let summary = null;
  for (let i = lines.findIndex((l) => l.startsWith('# ')) + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/^[-#>|]/.test(l)) break;
    summary = l;
    break;
  }

  const section = (heading) => {
    const start = lines.findIndex((l) => l.trim() === heading);
    if (start === -1) return [];
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => /^#{1,3} /.test(l));
    return end === -1 ? rest : rest.slice(0, end);
  };

  // "### Request body" table rows: | `field` | Required | Used for |
  const fields = {};
  for (const l of section('### Request body')) {
    const m = l.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]*)\|\s*(.*?)\s*\|\s*$/);
    if (m) fields[m[1]] = { required: /^yes/i.test(m[2].trim()), description: m[3] };
  }

  const responses = section('### Responses').join('\n').trim() || null;

  return { title, summary, fields, responses, mdFile };
}

// ------------------------------------------------------------ workflow JSON

// Every string inside a node's parameters, with the If-condition it belongs to (if any).
function* walkStrings(value, condition = null) {
  if (typeof value === 'string') yield { text: value, condition };
  else if (Array.isArray(value)) for (const v of value) yield* walkStrings(v, condition);
  else if (value && typeof value === 'object') {
    const cond = value.operator && 'leftValue' in value ? value : condition;
    for (const v of Object.values(value)) yield* walkStrings(v, cond);
  }
}

// Body fields are not declared anywhere: collect every `body.<field>` the workflow reads,
// keyed by dotted path (`correo`, `customData.selection`). A trailing method call such as
// `body.correo.split(` is not part of the path. A field compared with a boolean operator is
// documented as boolean, one that is indexed (`body.payload.participants[0]`) as an array,
// anything else as string.
function inferBodyFields(nodes) {
  const fields = new Map();
  for (const node of nodes) {
    if (node.type === 'n8n-nodes-base.stickyNote') continue;
    for (const { text, condition } of walkStrings(node.parameters)) {
      for (const m of text.matchAll(/\bbody((?:\.[A-Za-z_]\w*)+)(\(|\[)?/g)) {
        const segments = m[1].slice(1).split('.');
        if (m[2] === '(') segments.pop();
        if (!segments.length) continue;
        const path = segments.join('.');
        const isBoolean = condition?.operator?.type === 'boolean' && condition.leftValue === text;
        const type = isBoolean ? 'boolean' : m[2] === '[' ? 'array' : 'string';
        if (!fields.has(path) || type !== 'string') fields.set(path, type);
      }
    }
  }
  return fields;
}

// Turns the dotted paths into a nested object schema, adding descriptions and required
// flags from the companion doc (looked up by the same dotted path).
function bodySchema(fields, docFields) {
  const root = { type: 'object', properties: {} };
  for (const [path, type] of fields) {
    const segments = path.split('.');
    let node = root;
    segments.forEach((segment, i) => {
      const leaf = i === segments.length - 1;
      const existing = node.properties[segment];
      if (leaf) {
        if (existing?.type !== 'object') node.properties[segment] = type === 'array' ? { type, items: {} } : { type };
        const doc = docFields[path];
        if (doc?.description) node.properties[segment].description = doc.description;
        if (doc?.required) {
          // A required leaf makes every object on the way to it required too.
          let parent = root;
          segments.forEach((s, j) => {
            (parent.required ??= []).includes(s) || parent.required.push(s);
            if (j < segments.length - 1) parent = parent.properties[s];
          });
        }
      } else {
        if (existing?.type !== 'object') node.properties[segment] = { type: 'object', properties: {} };
        node = node.properties[segment];
      }
    });
  }
  return root;
}

function describeResponse(webhook, nodes) {
  const mode = webhook.parameters.responseMode ?? 'onReceived';
  if (mode === 'responseNode') {
    const responders = nodes.filter((n) => n.type === 'n8n-nodes-base.respondToWebhook').map((n) => `\`${n.name}\``);
    return `Sent by the ${responders.join(' / ') || 'Respond to Webhook'} node. Branches that never reach it get n8n's default response.`;
  }
  if (mode === 'lastNode') return 'The output of the last node the workflow executed, returned once the workflow has finished.';
  return 'Sent immediately, before the workflow runs. The body only confirms that the workflow was started.';
}

function buildOperations(jsonFile) {
  const workflow = JSON.parse(readFileSync(jsonFile, 'utf8'));
  const nodes = workflow.nodes ?? [];
  const webhooks = webhookEndpoints(nodes);
  if (!webhooks.length) return [];

  const ref = workflowRef(jsonFile);
  const { slug } = ref;
  const doc = readCompanion(jsonFile);
  const tag = ref.areaTitle;
  const bodyFields = inferBodyFields(nodes);

  return webhooks.map(({ node: webhook, method: METHOD, path }, i) => {
    const method = METHOD.toLowerCase();
    const authCredential = Object.values(webhook.credentials ?? {})[0]?.name;
    const authenticated = (webhook.parameters.authentication ?? 'none') !== 'none';
    const auth = authenticated ? AUTH_SCHEMES[authCredential] ?? GENERIC_AUTH : null;

    const description = [
      doc.summary,
      doc.responses && `### Responses\n\n${doc.responses}`,
      // Relative to site/api/: the workflow's page in the workflow documentation.
      `[Workflow documentation: ${doc.title ?? slug}](../${docsRoute(ref)}) — node \`${webhook.name}\`.`,
    ].filter(Boolean).join('\n\n');

    const operation = {
      operationId: webhooks.length > 1 ? `${slug}-${i + 1}` : slug,
      summary: doc.title ?? titleCase(slug),
      description,
      tags: [tag],
      security: auth ? [{ [auth.id]: [] }] : [],
    };

    if (!['get', 'head', 'delete'].includes(method) && bodyFields.size) {
      const schema = bodySchema(bodyFields, doc.fields);
      operation.requestBody = { required: true, content: { 'application/json': { schema } } };
    }

    operation.responses = {
      200: { description: describeResponse(webhook, nodes), content: { 'application/json': { schema: { type: 'object' } } } },
    };
    if (authenticated) operation.responses[403] = { description: 'The authentication header is missing or wrong.' };

    operation['x-n8n'] = {
      workflowFile: relative(ROOT, jsonFile),
      node: webhook.name,
      responseMode: webhook.parameters.responseMode ?? 'onReceived',
      ...(authCredential && { credential: authCredential }),
    };

    return { path, method, operation, tag, auth };
  });
}

// ------------------------------------------------------------------- spec

function buildSpec() {
  const operations = findWorkflowFiles().flatMap(buildOperations);
  operations.sort((a, b) => a.tag.localeCompare(b.tag) || a.path.localeCompare(b.path));

  const paths = {};
  for (const { path, method, operation } of operations) {
    if (paths[path]?.[method]) throw new Error(`Two webhooks share ${method.toUpperCase()} ${path}`);
    (paths[path] ??= {})[method] = operation;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: API_TITLE,
      version: API_VERSION,
      description:
        'Every webhook endpoint exposed by the EVD n8n workflows, generated from the workflow JSON files in this repo.\n\n' +
        'The instance is only reachable over the EVD VPN. Request bodies are not declared in n8n; the fields listed here are the ones each workflow reads.',
    },
    servers: [{ url: SERVER_URL, description: 'n8n production webhooks (EVD VPN only)' }],
    tags: [...new Set(operations.map((o) => o.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: Object.fromEntries(
        operations.filter((o) => o.auth).map((o) => [o.auth.id, o.auth.scheme]).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
  };
}

// ------------------------------------------------------------------- YAML

const plainKey = (k) => (/^[A-Za-z_][\w-]*$/.test(k) ? k : JSON.stringify(k));

function toYaml(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return ' []\n';
    return '\n' + value.map((v) => {
      const body = toYaml(v, indent + 1);
      return body.startsWith('\n') ? `${pad}-${body.replace(/^\n\s*/, ' ')}` : `${pad}-${body}`;
    }).join('');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return ' {}\n';
    return '\n' + entries.map(([k, v]) => `${pad}${plainKey(k)}:${toYaml(v, indent + 1)}`).join('');
  }
  if (typeof value === 'string' && value.includes('\n')) {
    return ' |-\n' + value.split('\n').map((l) => (l ? pad + l : '')).join('\n') + '\n';
  }
  return ` ${JSON.stringify(value)}\n`;
}

// ------------------------------------------------------------------- HTML

function toHtml(spec) {
  // "</" must not appear inside the inline script.
  const embedded = JSON.stringify(spec).replace(/</g, '\\u003c');
  return `<!doctype html>
<!-- Generated by scripts/build-api-docs.mjs. Do not edit by hand; run "npm run build". -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API reference · ${SITE_TITLE}</title>
    <style>
      /* Site navigation shared with the workflow documentation. Scalar offsets its sticky
         sidebar and headings by --scalar-custom-header-height. */
      :root { --scalar-custom-header-height: 48px; }
      .site-nav {
        position: sticky; top: 0; z-index: 1000; height: 48px; box-sizing: border-box;
        display: flex; align-items: center; gap: 4px; padding: 0 16px;
        font: 500 14px/1 Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
        background: var(--scalar-background-1, #fff); color: var(--scalar-color-1, #1b1b1b);
        border-bottom: 1px solid var(--scalar-border-color, #e5e5e5);
      }
      .site-nav .brand { font-weight: 600; margin-right: 16px; }
      .site-nav a { color: var(--scalar-color-2, #666); text-decoration: none; padding: 7px 10px; border-radius: 6px; }
      .site-nav a:hover { color: var(--scalar-color-1, #1b1b1b); background: var(--scalar-background-2, #f6f6f6); }
      .site-nav a[aria-current] { color: var(--scalar-color-1, #1b1b1b); background: var(--scalar-background-2, #f6f6f6); }
    </style>
  </head>
  <body>
    <nav class="site-nav">
      <span class="brand">${SITE_TITLE}</span>
      <a href="../">Workflows</a>
      <a href="./" aria-current="page">API reference</a>
    </nav>
    <div id="app"></div>
    <script src="${SCALAR_CDN}"></script>
    <script>
      // Internal API: the page is read-only (no "Test Request", which would hit production)
      // and Scalar's hosted extras (share/deploy toolbar, AI chat, MCP) are off.
      // Follow the light/dark choice made on the workflow documentation page, if there is one.
      var savedTheme = null;
      try { savedTheme = localStorage.getItem('theme'); } catch (e) { /* storage unavailable */ }
      Scalar.createApiReference('#app', {
        ...(savedTheme ? { darkMode: savedTheme === 'dark' } : {}),
        hideTestRequestButton: true,
        hideClientButton: true,
        showDeveloperTools: 'never',
        agent: { disabled: true },
        mcp: { name: ${JSON.stringify(API_TITLE)}, url: '', disabled: true },
        content: ${embedded},
      });
    </script>
  </body>
</html>
`;
}

// ------------------------------------------------------------------- main

const spec = buildSpec();
const header = '# Generated by scripts/build-api-docs.mjs. Do not edit by hand; run "npm run build".\n';
mkdirSync(API_DIR, { recursive: true });
writeFileSync(join(API_DIR, 'openapi.yaml'), header + toYaml(spec).replace(/^\n/, ''));
writeFileSync(join(API_DIR, 'index.html'), toHtml(spec));

const count = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0);
console.log(`${relative(ROOT, API_DIR)}/: openapi.yaml and index.html written, ${count} endpoint(s)`);
