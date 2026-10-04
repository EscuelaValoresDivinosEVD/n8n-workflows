# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A documentation and version-control repo for the n8n workflows that run EVD's day-to-day automations. There is no application code, lint, or test tooling here — the content is exported n8n workflow JSON plus documentation generated from it. The commands are `npm run build`, which regenerates the documentation site in `site/` (`build:docs` and `build:api` build one page each), and `npm run serve`, which serves `site/` at http://localhost:3111 (run `npm install` once for the `serve` and `marked` dev dependencies). [brief.md](brief.md) is the source of truth for the project's goals.

The workflows run on a self-hosted n8n Community instance at https://auto.evdsky.com/, reachable only over the EVD VPN. Don't assume the instance is reachable from this machine; workflow JSON is exported from n8n and brought into the repo by the user.

## Hard rules when importing a workflow JSON

1. **Remove the `pinData` object** from every workflow JSON brought into the repo. Pinned data is captured from real executions and contains request headers, client IPs, real email addresses and names, and production webhook URLs. (`jq 'del(.pinData)' in.json > out.json`)
2. **If anything else looks sensitive, ask before removing it** — don't strip it silently and don't leave it without flagging it. The user confirms each case. Things to look for: hard-coded tokens or keys in node parameters, personal data in `Set`/`Code` node values, internal hostnames/ports, `meta.instanceId`.

A straight-from-n8n download can be parked in `raw/` or named `*.raw.json`; [.gitignore](.gitignore) excludes both, so an export with its `pinData` intact cannot be committed by accident. The cleaned copy goes in the workflow's folder under its kebab-case name.

3. **Check whether the editor is showing unpublished changes.** A canvas copy takes whatever the editor shows, which is the draft. If the workflow header shows a "Publish" button with a yellow dot (instead of a published state), the imported JSON may differ from the version that is actually running. Import it anyway, tell the user, and add a note saying so near the top of the companion `.md`. **Always document the live (published) version, not the draft**: where the two differ (webhook path, method, messages, behaviour), the companion `.md` and the OpenAPI spec describe what is published, and the draft's differences are listed only in that note. When the draft's nodes or connections really differ, the JSON in the repo should also be the published version: read `activeVersion.nodes` / `activeVersion.connections` from `GET /rest/workflows/<id>` in the logged-in browser tab (compare `versionId` with `activeVersionId` to detect a draft). Large values cannot be copied out of the page through the clipboard, so patch the draft locally and confirm it with a SHA-256 of the sorted-key JSON computed on both sides.

**Preferred way to get the JSON out of n8n (used for the `highlevel` batch):** in the logged-in tab, fetch each workflow from `GET /rest/workflows/<id>` with JavaScript, build one bundle of `activeVersion.nodes` / `activeVersion.connections` (the published version) plus `pinData`, `meta`, name, settings and a SHA-256 per workflow, put it on the clipboard through a one-off `copy` event listener (`e.clipboardData.setData`) triggered by pressing Cmd+C on the page, then `pbpaste` it, split it locally and check every hash. One copy covers the whole list, it always yields the published version, and it avoids the canvas copy's failures. The API copy has no `meta.instanceId`; add it so the files match canvas exports.

When copying the canvas instead: clear the clipboard first (`pbcopy </dev/null`) and check the saved file is non-empty and has the expected node count, because a failed copy leaves the clipboard empty (it happens when Chrome is not the focused window). If the copy keeps failing, read the workflow from `GET /rest/workflows/<id>` instead and confirm it with the SHA-256 check described above.

Already decided by the user (2026-10-03), don't ask again — but still list what was found and what was done:

- **Stay in the cleaned JSON:** `meta.instanceId`, service-account and sender/recipient addresses (`n8n.workspace@evdsky.com`, `auto@clev.org`, `n8n@evdsky.com`, `servidores@evdsky.com`), data table / project IDs, `webhookId`s, the HighLevel location ID, Basecamp bucket and message board IDs, and the internal server IP in the CLEV error notifier's email template.
- **Hard-coded tokens are removed:** replace the value with a named placeholder, e.g. `Bearer REDACTED_HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`, and say in the companion `.md` that the repo copy holds a placeholder.
- **Sample payloads in sticky notes:** replace personal data and secrets (names, emails, phones, dates of birth, contact IDs, IPs, auth header values, trace IDs) with `<redacted>` and leave the rest of the note intact.

- **`Webhook test` (CLEV) stays** in the repo and in the API docs, even though it looks like a leftover experiment.

Grep the cleaned files afterwards (`pit-`, `Bearer `, email addresses, IPs) to confirm nothing was missed; the raw copies in `raw/` keep the originals.

`credentials` blocks on nodes hold only an n8n credential ID and display name (no secrets); they are needed to document which credentials a workflow uses.

## Target layout

Workflows are grouped by area under `workflows/` (currently `google-workspace`, `clev` and `highlevel`). **Area folder names are always lowercase kebab-case**. Each workflow gets its own folder named after the workflow, containing two files that share the workflow's n8n name in kebab-case:

```
workflows/
  <area>/                    # e.g. google-workspace
    <workflow-name>/
      <workflow-name>.json   # the exported workflow, pinData removed
      <workflow-name>.md     # companion documentation
```

**Moving a workflow into its area folder is a manual step the user does themselves, unless they name the area folder when asking for the import** — then import straight into `workflows/<area>/`. Otherwise import new workflows into `workflows/<workflow-name>/` and, once the import session is finished, **remind the user to move them into the right area folder — they asked for this reminder and called it very important.** Don't move them yourself. Run `npm run build` again after the move, since the area folder is the group name on both pages.

The companion `.md` covers: what the workflow does from start to finish, what triggers it, which credentials it uses, any "tricky" nodes and why they are tricky, and who uses it.

## Documentation site

Everything that gets deployed lives in `site/`, **one site with two pages** that link to each other (the user chose this over two separate sites and over a single merged page):

```
site/
  index.html        # workflow documentation, from the companion .md files
  api/
    index.html      # webhook API reference, rendered with Scalar
    openapi.yaml    # the single OpenAPI spec behind it
```

**All of `site/` is generated — never edit it by hand.** `npm run build` rewrites it; rebuild after any change to a workflow's `.json` or `.md`. There is exactly one workflow page and one API page for the whole repo: never generate one per workflow or per endpoint. Both pages carry the same top navigation ("Workflows" / "API reference"); each webhook workflow links to its endpoint in the API reference and each endpoint links back to its workflow.

Shared code is in [scripts/lib/workflows.mjs](scripts/lib/workflows.mjs): workflow discovery (`workflows/**/<name>/<name>.json`), the `AREA_TITLES` map and the cross-link routes. The area folder becomes the group name on both pages, in title case (`google-workspace` → "Google Workspace"); where that is wrong, add the display name to `AREA_TITLES` (the folder is `clev` but the pages show "CLEV").

To preview: the user keeps the site served at http://localhost:3111 with `npm run serve` — use that, don't start another server. **If it is not running, remind the user to start it with `npm run serve`** (check with `curl -s -o /dev/null -w '%{http_code}' http://localhost:3111/`). The script binds to 127.0.0.1 and serves only `site/`, on purpose: `serve` listens on every network interface by default, and serving the repo root would expose the gitignored `raw/` exports that still hold tokens and personal data.

### Workflow documentation (`site/index.html`)

Built by [scripts/build-workflow-docs.mjs](scripts/build-workflow-docs.mjs): a sidebar grouped by area with search, an overview, and one view per workflow showing the rendered companion `.md`, a facts panel, the endpoint card, and the workflow JSON in a collapsible panel with a copy button.

- Markdown is rendered at build time with `marked`. Styling is Tailwind from its CDN (the user's choice) plus [scripts/lib/workflow-docs.css](scripts/lib/workflow-docs.css); behaviour is [scripts/lib/workflow-docs.client.js](scripts/lib/workflow-docs.client.js). Both are inlined into the page.
- The build depends on the companion `.md` opening the same way every time: `# Title`, one summary paragraph, then a `- **Key:** value` list of facts. The title, summary and facts are lifted out of the body and shown in the page header and the facts panel.
- Every `## ` heading becomes a section link at the top of the workflow's view.
- A `> **Draft note.**` blockquote is shown as an amber callout and adds an "Unpublished draft in n8n" badge. It is the only blockquote the companion docs should use.
- A workflow name written in backticks is turned into a link to that workflow (same area first), so keep writing other workflows' names exactly, in backticks.
- The trigger badges (Webhook, Schedule, Sub-workflow, Error handler) come from the enabled trigger nodes in the `.json`.
- The cleaned `.json` is embedded in the page, so anything in a workflow file is published with the site.

### Webhook API reference (`site/api/`)

Webhook-triggered workflows are additionally documented as one API: a **single OpenAPI (YAML) spec** holding every webhook endpoint, rendered by **Scalar**. Built by [scripts/build-api-docs.mjs](scripts/build-api-docs.mjs).

- From the `.json`: path, method (`GET` when `httpMethod` is absent), auth, response mode, and the body fields (every `body.<field>` the workflow reads; boolean when compared with a boolean operator, array when indexed, otherwise string; only for methods that take a body).
- From the companion `.md`: the H1 becomes the endpoint summary, the first paragraph the description, the `### Request body` table supplies field descriptions and which fields are required, and the `### Responses` table is copied into the description. Keep those headings and table shapes when writing a companion `.md`, and keep field descriptions self-contained (no "see below").
- The server URL and titles are constants at the top of the script. The server URL is `https://auto.evdsky.com:45333/webhook`. Port 45333 comes from the pinned requests in the exports; the user chose to keep it until they can verify which address the calling services use today.
- The page is deliberately read-only: the user asked for Scalar's "Test Request" button (it would hit production), "Ask AI" and "Generate MCP" to be hidden. The API client button and share/deploy toolbar are hidden for the same reason. Keep them off; the options are set in the script's HTML template.
- The spec is embedded in `index.html`; Scalar itself loads from the jsDelivr CDN. The page follows the light/dark choice made on the workflow page.
- Auth: the header name of an n8n header-auth credential is not in the export, so the script has an `AUTH_SCHEMES` map keyed by credential name (Workspace and HighLevel = `Authorization: Bearer`, CLEV = `webhook-auth` header). Add an entry when a new webhook credential shows up; unknown credentials fall back to a generic placeholder scheme.
- Nested body fields are written as dotted paths in the `### Request body` table (e.g. `customData.selection`) and become nested objects in the spec.

## Committing

- Group related files together and give each commit a descriptive message.
- **Each workflow gets its own commit**: its `.json` and companion `.md` go together, and changes to two workflows are never mixed in one commit.
- Repo-wide files (`CLAUDE.md`, `.gitignore`, `package.json`, `scripts/`, the generated `site/`) are committed separately from workflow folders. Rebuild before committing a workflow change so the generated docs never lag behind.
- Don't push: no remote has been set up.

## Current state

The seven published workflows were imported on 2026-10-03 and now live in `workflows/google-workspace/`, each with a first-draft companion `.md` (the `.md` format is still being decided; keep new ones consistent with the existing ones). A third batch of ten (the HighLevel workflows, a third n8n login) went into `workflows/highlevel/`. A second batch of seven (the CLEV reporting workflows, from a different n8n login on the same instance) was imported the same day into `workflows/clev/`. The generated site in `site/` covers all 24 workflows and every webhook endpoint. The user is initialising git locally; there is no remote yet, so don't expect push/PR workflows.

[n8n-workflow-sample.json](n8n-workflow-sample.json) at the root is **a reference sample, not a tracked workflow**: it is gitignored (its pinned request carries a real `Authorization` header), deliberately left with its `pinData` intact and needs no folder, kebab-case rename, or companion `.md`. Use it to see the shape of a real export. The import rules above apply to actual workflows brought in, not to this file.

## Reading n8n workflow JSON

- `nodes[]` is a flat list; execution order is not the array order. Follow `connections`, which is keyed by source node **name** (not ID) — `main[0]` is the first output, `main[1]` the second. For `If` nodes that is true / false; nodes with `onError: continueErrorOutput` use the second output for the error branch.
- A clipboard export (like the sample) has only `nodes`, `connections`, `pinData`, and `meta` — no `name`, `settings`, or `active`. The workflow name then has to come from the n8n page (workflow title or list entry) when importing through the browser, or from the user otherwise, since it determines the folder and file names.
- For webhook docs, the relevant node is `n8n-nodes-base.webhook`: `parameters.path` and `parameters.httpMethod` give the endpoint, `parameters.authentication` plus the node's `credentials` give the auth scheme, and `responseMode: responseNode` means the response is shaped by a `Respond to Webhook` node elsewhere in the graph — nodes connected after it keep running once the caller already has its response.
- The request body schema is not declared anywhere; infer it from the expressions that read `$json.body.*` (validation `If` nodes are the best source). Field names and node names in these workflows are often in Spanish and inconsistently cased (e.g. `correo`, `correoNuevo`, `nombreNuevo`, `ApellidoNuevo`) — reproduce them exactly in the docs.
- `jq` is the practical tool for inspecting these files, e.g. `jq '[.nodes[] | {name, type, credentials}]' file.json` or `jq '.connections' file.json`.
