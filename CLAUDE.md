# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A documentation and version-control repo for the n8n workflows that run EVD's day-to-day automations. There is no application code, lint, or test tooling here — the content is exported n8n workflow JSON plus documentation generated from it. The only command is `npm run build` (plain Node, no dependencies), which regenerates the webhook API docs. [brief.md](brief.md) is the source of truth for the project's goals.

The workflows run on a self-hosted n8n Community instance at https://auto.evdsky.com/, reachable only over the EVD VPN. Don't assume the instance is reachable from this machine; workflow JSON is exported from n8n and brought into the repo by the user.

## Hard rules when importing a workflow JSON

1. **Remove the `pinData` object** from every workflow JSON brought into the repo. Pinned data is captured from real executions and contains request headers, client IPs, real email addresses and names, and production webhook URLs. (`jq 'del(.pinData)' in.json > out.json`)
2. **If anything else looks sensitive, ask before removing it** — don't strip it silently and don't leave it without flagging it. The user confirms each case. Things to look for: hard-coded tokens or keys in node parameters, personal data in `Set`/`Code` node values, internal hostnames/ports, `meta.instanceId`.

A straight-from-n8n download can be parked in `raw/` or named `*.raw.json`; [.gitignore](.gitignore) excludes both, so an export with its `pinData` intact cannot be committed by accident. The cleaned copy goes in the workflow's folder under its kebab-case name.

3. **Check whether the editor is showing unpublished changes.** A canvas copy takes whatever the editor shows, which is the draft. If the workflow header shows a "Publish" button with a yellow dot (instead of a published state), the imported JSON may differ from the version that is actually running. Import it anyway, tell the user, and add a note saying so near the top of the companion `.md`. **Always document the live (published) version, not the draft**: where the two differ (webhook path, method, messages, behaviour), the companion `.md` and the OpenAPI spec describe what is published, and the draft's differences are listed only in that note. When the draft's nodes or connections really differ, the JSON in the repo should also be the published version: read `activeVersion.nodes` / `activeVersion.connections` from `GET /rest/workflows/<id>` in the logged-in browser tab (compare `versionId` with `activeVersionId` to detect a draft). Large values cannot be copied out of the page through the clipboard, so patch the draft locally and confirm it with a SHA-256 of the sorted-key JSON computed on both sides.

Already decided, don't ask again: `meta.instanceId`, the service-account address inside credential display names, data table / project IDs, and `webhookId`s all stay in the cleaned JSON.

`credentials` blocks on nodes hold only an n8n credential ID and display name (no secrets); they are needed to document which credentials a workflow uses.

## Target layout

Workflows are grouped by area under `workflows/` (currently only `google-workspace`). Each workflow gets its own folder named after the workflow, containing two files that share the workflow's n8n name in kebab-case:

```
workflows/
  <area>/                    # e.g. google-workspace
    <workflow-name>/
      <workflow-name>.json   # the exported workflow, pinData removed
      <workflow-name>.md     # companion documentation
```

**Moving a workflow into its area folder is a manual step the user does themselves.** Import new workflows into `workflows/<workflow-name>/` and, once the import session is finished, **remind the user to move them into the right area folder — they asked for this reminder and called it very important.** Don't move them yourself. Run `npm run build` again after the move, since the area folder becomes the endpoint's tag.

The companion `.md` covers: what the workflow does from start to finish, what triggers it, which credentials it uses, any "tricky" nodes and why they are tricky, and who uses it.

## Webhook API docs

Webhook-triggered workflows are additionally documented as one API, not per workflow:

- A **single OpenAPI (YAML) spec** holding every webhook endpoint exposed across all n8n workflows.
- A **single `index.html`** rendering that spec with **Scalar**, static and self-contained enough to be served from GitHub Pages or any other host.

There is exactly one `index.html` for the whole repo. Never generate one per workflow or per endpoint.

Both files live at the repo root and are **generated — never edit `openapi.yaml` or `index.html` by hand**. `npm run build` runs [scripts/build-api-docs.mjs](scripts/build-api-docs.mjs), which scans `workflows/**/<name>/<name>.json` and rewrites both. Adding or changing a webhook workflow means importing its files and running the build.

- From the `.json`: path, method (`GET` when `httpMethod` is absent), auth, response mode, and the body fields (every `body.<field>` the workflow reads; boolean when compared with a boolean operator, otherwise string; only for methods that take a body).
- From the companion `.md`: the H1 becomes the endpoint summary, the first paragraph the description, the `### Request body` table supplies field descriptions and which fields are required, and the `### Responses` table is copied into the description. Keep those headings and table shapes when writing a companion `.md`, and keep field descriptions self-contained (no "see below").
- The area folder becomes the tag. The server URL and titles are constants at the top of the script.
- The spec is embedded in `index.html`, so the page is a single file; Scalar itself loads from the jsDelivr CDN.
- To preview: `python3 -m http.server` in the repo root, then open `index.html`.

## Committing

- Group related files together and give each commit a descriptive message.
- **Each workflow gets its own commit**: its `.json` and companion `.md` go together, and changes to two workflows are never mixed in one commit.
- Repo-wide files (`CLAUDE.md`, `.gitignore`, `package.json`, `scripts/`, `openapi.yaml`, `index.html`) are committed separately from workflow folders. Rebuild before committing a workflow change so the generated docs never lag behind.
- Don't push: no remote has been set up.

## Current state

The seven published workflows were imported on 2026-10-03 and now live in `workflows/google-workspace/`, each with a first-draft companion `.md` (the `.md` format is still being decided; keep new ones consistent with the existing ones). `openapi.yaml` and `index.html` are generated and cover the five webhook endpoints. The user is initialising git locally; there is no remote yet, so don't expect push/PR workflows.

[n8n-workflow-sample.json](n8n-workflow-sample.json) at the root is **a reference sample, not a tracked workflow**: it is gitignored (its pinned request carries a real `Authorization` header), deliberately left with its `pinData` intact and needs no folder, kebab-case rename, or companion `.md`. Use it to see the shape of a real export. The import rules above apply to actual workflows brought in, not to this file.

## Reading n8n workflow JSON

- `nodes[]` is a flat list; execution order is not the array order. Follow `connections`, which is keyed by source node **name** (not ID) — `main[0]` is the first output, `main[1]` the second. For `If` nodes that is true / false; nodes with `onError: continueErrorOutput` use the second output for the error branch.
- A clipboard export (like the sample) has only `nodes`, `connections`, `pinData`, and `meta` — no `name`, `settings`, or `active`. The workflow name then has to come from the n8n page (workflow title or list entry) when importing through the browser, or from the user otherwise, since it determines the folder and file names.
- For webhook docs, the relevant node is `n8n-nodes-base.webhook`: `parameters.path` and `parameters.httpMethod` give the endpoint, `parameters.authentication` plus the node's `credentials` give the auth scheme, and `responseMode: responseNode` means the response is shaped by a `Respond to Webhook` node elsewhere in the graph — nodes connected after it keep running once the caller already has its response.
- The request body schema is not declared anywhere; infer it from the expressions that read `$json.body.*` (validation `If` nodes are the best source). Field names and node names in these workflows are often in Spanish and inconsistently cased (e.g. `correo`, `correoNuevo`, `nombreNuevo`, `ApellidoNuevo`) — reproduce them exactly in the docs.
- `jq` is the practical tool for inspecting these files, e.g. `jq '[.nodes[] | {name, type, credentials}]' file.json` or `jq '.connections' file.json`.
