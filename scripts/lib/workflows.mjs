// Shared by the two documentation builds: where things live and how workflows are found.

import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WORKFLOWS_DIR = join(ROOT, 'workflows');

// Everything that gets deployed. One site, two pages:
//   site/index.html      - workflow documentation (build-workflow-docs.mjs)
//   site/api/index.html  - webhook API reference rendered with Scalar (build-api-docs.mjs)
//   site/api/openapi.yaml
export const SITE_DIR = join(ROOT, 'site');
export const API_DIR = join(SITE_DIR, 'api');

export const SITE_TITLE = 'EVD n8n';

// Area folders are lowercase kebab-case; the name shown in the docs is the folder name in
// title case unless it is listed here.
const AREA_TITLES = {
  clev: 'CLEV',
  highlevel: 'HighLevel',
};

export const titleCase = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
export const areaTitle = (area) => (area ? AREA_TITLES[area] ?? titleCase(area) : 'Workflows');

// A workflow file is <dir>/<name>/<name>.json, at any depth under workflows/.
export function findWorkflowFiles(dir = WORKFLOWS_DIR) {
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

// Where a workflow sits: its slug, its area folder (null when it is not in one yet) and files.
export function workflowRef(jsonFile) {
  const slug = basename(jsonFile, '.json');
  const relDir = relative(WORKFLOWS_DIR, dirname(jsonFile)).split('/');
  const area = relDir.length > 1 ? relDir[0] : null;
  const mdFile = jsonFile.replace(/\.json$/, '.md');
  return { slug, area, areaTitle: areaTitle(area), jsonFile, mdFile: existsSync(mdFile) ? mdFile : null };
}

// The two pages link to each other per workflow / endpoint.
// Workflow page (from site/api/):  ../#/<area>/<slug>
// Scalar endpoint (from site/):    api/#tag/<tag-slug>/<METHOD>/<path>
export const docsRoute = (ref) => `#/${ref.area ?? '-'}/${ref.slug}`;
const tagSlug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const apiRoute = (ref, method, path) => `#tag/${tagSlug(ref.areaTitle)}/${method.toUpperCase()}${path}`;

// The endpoint a Webhook node exposes, as documented in the API reference.
export function webhookEndpoints(nodes) {
  return (nodes ?? [])
    .filter((n) => n.type === 'n8n-nodes-base.webhook' && !n.disabled)
    .map((n) => ({
      node: n,
      method: (n.parameters.httpMethod ?? 'GET').toUpperCase(),
      path: '/' + String(n.parameters.path).replace(/^\/+/, ''),
    }));
}
