# Crear menú reportes CLEV

Regenerates the numbered menu of HighLevel pipelines that people choose from when they ask for a report. It lists the current pipelines, numbers them, and writes the menu text and the list of valid numbers into two HighLevel custom values.

- **n8n workflow:** `Crear menú reportes CLEV` (ID `HkY2uV5daiW4eW95`), project Personal, folder Reportes CLEV
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

`POST /webhook/clev/create-menu` on the n8n instance (`Webhook` node, path `/clev/create-menu`).

Authentication is header auth, using the credential `Header Auth new auto@clev.org`.

No `responseMode` is set, so n8n answers immediately and the menu is rebuilt afterwards. The response carries a `Content-Type: application/json` header.

`When clicking ‘Execute workflow’` is also on the canvas but is disabled.

### Request body

None. The workflow reads no request parameters.

## What it does

1. **List the pipelines.** `Get Pipelines1` calls `GET https://services.leadconnectorhq.com/opportunities/pipelines`; `split pipelines1` and `split Pipeline ids names1` reduce each pipeline to `id`, `name` and `dateAdded`.
2. **Drop retired pipelines.** `Descartar OLD` discards pipelines with "old" in their name (case-insensitive).
3. **Number them.** `Sort` orders the rest by `dateAdded`, newest first, and `Add index` numbers them from 1.
4. **Find the two custom values.** `Get Custom Values` reads HighLevel's custom values once, and `Switch` routes the one keyed `numeros_reportes_automaticos` to its first output and the one keyed `menu_reportes_automaticos` to its second.
5. **Write the valid numbers.** `Edit Fields` builds `0,1,2,…` and `Update custom_values.numeros_reportes_automaticos field` saves it with a `PUT`.
6. **Write the menu text.** `Edit Fields1` builds `_*(0)*_ Todos _*| (1)*_ {name} _*| (2)*_ {name} …` and `Update custom_values.menu_reportes_automaticos` saves it with a `PUT`.

### Responses

| Situation | What the caller gets |
|---|---|
| Any call with valid auth | n8n's immediate "workflow started" response. It says nothing about whether the menu was updated. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth new auto@clev.org` | `httpHeaderAuth` | `l03Uxy1XYUmnJuAk` | `Webhook` |

The four HighLevel HTTP nodes (`Get Pipelines1`, `Get Custom Values` and the two `Update custom_values…` nodes) do not use a credential: they carry the HighLevel private integration token directly in an `Authorization` header parameter. In this repo's JSON the token is replaced with `REDACTED_HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`.

Failed executions are reported by `Notificación de errores` (ID `bPvIORzqZ5PzAIRx`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Switch` compares against HighLevel's own key syntax.** The right-hand values `{{ custom_values.numeros_reportes_automaticos }}` and `{{ custom_values.menu_reportes_automaticos }}` look like n8n expressions but are plain text: that is how HighLevel writes a custom value's `fieldKey`.
- **The menu text is the contract with the report workflow.** `Get menu from CRM` parses this exact format back into numbers and names, and `Informe de oportunidades CLEV v2.1` matches the names against live pipelines. Changing the format in `Edit Fields1` breaks both. The `_*…*_` markers are chat-style bold/italic markup.
- **Numbers follow creation date, not a fixed order.** Adding a pipeline makes it number 1 and shifts every other number, so the menu must be regenerated whenever pipelines change.
- **`Edit Fields` and `Edit Fields1` run once** (`executeOnce`) and read every row of `Add index` through `$items("Add index")`.
- **`Descartar OLD` uses its false branch.** The true output (names containing "old") is not connected.
- **The leading slash in the webhook path** (`/clev/create-menu`) is part of the node's setting.

## Who uses it

Not recorded in the workflow. Its output is read by `Get menu from CRM` and, through it, by `Informe de oportunidades CLEV v2.1`. To be filled in: who or what calls the webhook when pipelines change.
