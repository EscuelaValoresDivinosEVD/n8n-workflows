#!/usr/bin/env node
// Builds the webhook API docs from the workflow JSON files.
//
//   node scripts/build-api-docs.mjs      (or: npm run build)
//
// Reads every workflows/**/<name>/<name>.json, finds its Webhook nodes and writes:
//   openapi.yaml  - one OpenAPI spec for every webhook endpoint
//   index.html    - that spec rendered with Scalar (spec embedded, so the page is one file)
//
// What comes from where:
//   - path, method, auth, response mode, body field names and types: the workflow .json
//   - workflow name, summary, field descriptions, "Responses" table: the companion .md
// Both output files are generated. Edit the workflow files or this script, not the outputs.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = join(ROOT, 'workflows');

const API_TITLE = 'EVD n8n Webhooks';
const API_VERSION = '1.0.0';
// Port 45333 is what the pinned requests in the n8n exports were sent to. Not re-verified against today's callers.
const SERVER_URL = 'https://auto.evdsky.com:45333/webhook';
const SCALAR_CDN = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';

// ---------------------------------------------------------------- discovery

// A workflow file is <dir>/<name>/<name>.json, at any depth under workflows/.
function findWorkflowFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = join(dir, entry.name);
    const candidate = join(sub, `${entry.name}.json`);
    if (existsSync(candidate)) found.push(candidate);
    else found.push(...findWorkflowFiles(sub));
  }
  return found.sort();
}

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

// Body fields are not declared anywhere: collect every `body.<field>` the workflow reads.
// A field compared with a boolean operator is documented as boolean, anything else as string.
function inferBodyFields(nodes) {
  const fields = new Map();
  for (const node of nodes) {
    if (node.type === 'n8n-nodes-base.stickyNote') continue;
    for (const { text, condition } of walkStrings(node.parameters)) {
      for (const m of text.matchAll(/\bbody\.([A-Za-z_]\w*)/g)) {
        const isBoolean = condition?.operator?.type === 'boolean' && condition.leftValue === text;
        if (!fields.has(m[1]) || isBoolean) fields.set(m[1], isBoolean ? 'boolean' : 'string');
      }
    }
  }
  return fields;
}

const titleCase = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

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
  const webhooks = nodes.filter((n) => n.type === 'n8n-nodes-base.webhook' && !n.disabled);
  if (!webhooks.length) return [];

  const slug = basename(jsonFile, '.json');
  const doc = readCompanion(jsonFile);
  const relDir = relative(WORKFLOWS_DIR, dirname(jsonFile)).split('/');
  const tag = relDir.length > 1 ? titleCase(relDir[0]) : 'Workflows';
  const bodyFields = inferBodyFields(nodes);

  return webhooks.map((webhook, i) => {
    const method = (webhook.parameters.httpMethod ?? 'GET').toLowerCase();
    const path = '/' + String(webhook.parameters.path).replace(/^\/+/, '');
    const authCredential = Object.values(webhook.credentials ?? {})[0]?.name;
    const authenticated = (webhook.parameters.authentication ?? 'none') !== 'none';

    const description = [
      doc.summary,
      doc.responses && `### Responses\n\n${doc.responses}`,
      `Workflow: \`${doc.title ?? slug}\` — node \`${webhook.name}\`. Source: \`${relative(ROOT, jsonFile)}\`.`,
    ].filter(Boolean).join('\n\n');

    const operation = {
      operationId: webhooks.length > 1 ? `${slug}-${i + 1}` : slug,
      summary: doc.title ?? titleCase(slug),
      description,
      tags: [tag],
      security: authenticated ? [{ headerAuth: [] }] : [],
    };

    if (!['get', 'head', 'delete'].includes(method) && bodyFields.size) {
      const properties = {};
      const required = [];
      for (const [name, type] of bodyFields) {
        properties[name] = { type };
        if (doc.fields[name]?.description) properties[name].description = doc.fields[name].description;
        if (doc.fields[name]?.required) required.push(name);
      }
      const schema = { type: 'object', properties };
      if (required.length) schema.required = required;
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

    return { path, method, operation, tag };
  });
}

// ------------------------------------------------------------------- spec

function buildSpec() {
  const operations = findWorkflowFiles(WORKFLOWS_DIR).flatMap(buildOperations);
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
      securitySchemes: {
        headerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'n8n header auth. Send `Authorization: Bearer <token>`; the token is held in the n8n credential named on each endpoint.',
        },
      },
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
    <title>${API_TITLE}</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="${SCALAR_CDN}"></script>
    <script>
      // Internal API: the page is read-only (no "Test Request", which would hit production)
      // and Scalar's hosted extras (share/deploy toolbar, AI chat, MCP) are off.
      Scalar.createApiReference('#app', {
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
writeFileSync(join(ROOT, 'openapi.yaml'), header + toYaml(spec).replace(/^\n/, ''));
writeFileSync(join(ROOT, 'index.html'), toHtml(spec));

const count = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0);
console.log(`openapi.yaml and index.html written: ${count} endpoint(s)`);
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) console.log(`  ${method.toUpperCase().padEnd(5)} ${path}  (${op.summary})`);
}
