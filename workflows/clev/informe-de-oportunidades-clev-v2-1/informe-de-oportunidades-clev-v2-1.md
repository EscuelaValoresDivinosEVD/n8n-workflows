# Informe de oportunidades CLEV v2.1

Builds a report of HighLevel opportunities, counted by pipeline, stage and contact type, and posts it as a message in Basecamp. It is called over a webhook with the number of the pipeline the requester picked from a menu, and afterwards stores the link to the Basecamp message back in HighLevel.

- **n8n workflow:** `Informe de oportunidades CLEV v2.1` (ID `4PpsPa9jLFFK0hu2`), project Personal, folder Reportes CLEV
- **Status at import:** Published
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

> **Draft note.** At import the editor showed unpublished changes (draft last saved 2026-08-27, published version from 2026-08-13). A comparison of the two versions in n8n found no difference in nodes, connections or canvas positions, so this JSON behaves like the published version.

## Trigger

`POST /webhook/clev/reporte` on the n8n instance (`Webhook generación reporte` node, path `clev/reporte`).

Authentication is header auth, using the credential `Header Auth new auto@clev.org`.

The webhook answers when the workflow has finished, with no body (`responseMode: lastNode`, `responseData: noData`).

`When clicking ‘Execute workflow’` is also on the canvas but is disabled.

### Request body

The body schema is not declared in the workflow; this is inferred from the expressions that read `body.*`. The sample payload kept on the canvas shows the caller is a HighLevel workflow, which sends the whole contact record; only these fields are read.

| Field | Required | Used for |
|---|---|---|
| `customData.selection` | Yes | Number of the menu entry the requester chose. `0` means all pipelines; any other number is a pipeline's position in the menu stored in HighLevel. |
| `full_name` | No | Name of the requester, printed at the end of the report ("Reporte solicitado por"). |

## What it does

1. **Read the selection.** `Extract menu selection` and `Menu Selection Number` turn `customData.selection` into the number `menuSelection`.
2. **Resolve the selection to a pipeline.** `Call Get menu from crm` runs the sub-workflow `Get menu from CRM`, which returns the stored menu as rows of `index` and `name`. `Filter menu selection` keeps the row whose `index` equals `menuSelection`.
3. **List the pipelines.** `Call Get Highlevel pipelines names and ids` runs the sub-workflow of that name, and `Not contain old` drops pipelines with "old" in their name. `If selection is todos 0` then either keeps all of them (selection `0`) or, through `Filter`, only the pipeline whose name matches the selected menu row.
4. **Fetch the opportunities.** `Get opportunities from menu pipelines` calls `GET https://services.leadconnectorhq.com/opportunities/search` once per pipeline. `Split opportunities` and `Opportunities` reduce each opportunity to its ids and `status`.
5. **Build the lookup tables,** in parallel with steps 2–4:
   - `Mappings Pipelines`: pipeline id → pipeline name.
   - `Call Get pipeline stages` (sub-workflow `Get Highlevel pipeline stages`) → `Mappings Stages` (stage id → stage name) and `Mappings Posición` (stage id → position).
   - `Search Iniciados` searches HighLevel contacts whose `tipo` is `Iniciado`, `Iniciado Ashram`, `Instructor Shakti Yoga` or `Swami`, 500 per page; `Mappings iniciados` maps each of those contact ids to `IN`.
   - `Create Mapping table` appends the three tables into one.
6. **Translate ids into names.** `ApplyMap` adds `Secuencia` (pipeline name), `Etapa` (stage name) and `Tipo` (`IN` for the contacts found in step 5, `PG` for everyone else) to each opportunity.
7. **Count.** `Remove empty` drops blank items, `Summarize` counts opportunities per `Secuencia`, `Etapa`, `Tipo` and stage, `ApplyMap2` adds the stage position, and `Sort`, `Sort1`, `Sort2` order the rows by type, stage position and pipeline.
8. **Write the report.** `Generate HTML text` builds the HTML: one block per pipeline with its total and one line per stage ("stage: total (n IN / n PG)"), a grand total, and the requester's name.
9. **Post it.** `Merge` attaches the selected menu row, and `Create a message` posts the report to a Basecamp message board with the subject `Reporte automático - {pipeline or "Todos"} - Corte {date}`.
10. **Store the link.** `Get Custom Values` reads HighLevel's custom values, `Filter1` picks the one whose key contains `custom_values.link_reporte_basecamp`, and the last node (`Update custom_values.link_reporte_basecamp_no_editar__generado_automticamente`) writes the Basecamp message URL into it.

### Responses

| Situation | What the caller gets |
|---|---|
| Report posted | An empty response, once the Basecamp message exists and the link has been stored. |
| Any step fails | n8n's error response; the failure is also emailed by `Notificación de errores`. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth new auto@clev.org` | `httpHeaderAuth` | `l03Uxy1XYUmnJuAk` | `Webhook generación reporte` |
| `PIT Highlevel` | `httpHeaderAuth` | `53nRvLQKr8HYKatU` | `Get opportunities from menu pipelines` |
| `Basecamp+integración de auto@clev.org` | `basecamp4OAuth2Api` | `RwdW2MyWL1LsH7Ct` | `Create a message` |
| `HighLevel auto@clev.org` | `highLevelOAuth2Api` | `Nbf83BqOVEbmCgEC` | `Update Perdida opportunity to Stage Descartados1` (never runs, see below) |

Three HTTP nodes do not use a credential: `Search Iniciados`, `Get Custom Values` and the final `Update custom_values…` node carry the HighLevel private integration token directly in an `Authorization` header parameter. In this repo's JSON the token is replaced with `REDACTED_HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`.

It calls three sub-workflows: `Get menu from CRM`, `Get Highlevel pipelines names and ids` and `Get Highlevel pipeline stages`.

It needs three community nodes installed on the instance: `n8n-nodes-applymap` (`ApplyMap`, `ApplyMap1`, `ApplyMap2`), `n8n-nodes-basecamp` (`Create a message`) and `n8n-nodes-highlevelv2`.

Failed executions are reported by `Notificación de errores` (ID `bPvIORzqZ5PzAIRx`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **`If empty` always takes its false branch.** Its condition tests the constant `false`, so `Update Perdida opportunity to Stage Descartados1` never runs. The canvas is wired to move lost opportunities into the "Descartado" stage, but that update is switched off this way; lost opportunities only pass through `Split opportunities1` → `Opportunities1` → `ApplyMap1` before being merged back in.
- **`Split opportunities1` splits a field named `opportunity`,** which the items reaching it do not have. With `alwaysOutputData` on, that path appears to produce blank items, which `Remove empty` then discards. If so, opportunities that are not open and not already in "Descartado" are left out of the count. Not verified against an execution.
- **`Get opportunities from menu pipelines` does not paginate.** It makes one request per pipeline with no page or limit parameter, so a pipeline with more opportunities than HighLevel returns in one page would be under-counted. Not verified. Its `Version ` header also has a trailing space in the name.
- **The menu and the pipelines are matched by name.** The selected number is resolved through the menu text stored in HighLevel (written by `Crear menú reportes CLEV`), then matched to a pipeline by exact name in `Filter`. A pipeline renamed or added after the menu was last generated will not match until the menu is regenerated.
- **`ApplyMap` nodes are a community node** that looks values up in the table arriving on their second input. `Tipo` defaults to `PG` and unknown pipelines or stages to `ND`.
- **`Generate HTML text` formats the date in UTC-5** (`Etc/GMT+5`), regardless of the instance timezone.
- **`Sticky Note` holds a full sample webhook payload.** It shows what HighLevel sends: the request headers and the whole contact record. In n8n it contains a real person's details and the webhook secret; in this repo's JSON those values are replaced with `<redacted>` and the rest of the note is unchanged.
- **`Sticky Note1` is a to-do**: move the HighLevel authentication from OAuth2 to the private integration token. The HTTP nodes already use the token; the OAuth2 credential remains only on the node that never runs.

## Who uses it

CLEV staff, through HighLevel: a HighLevel workflow calls the webhook with the menu number a person chose, and the report appears in Basecamp. Which HighLevel workflow and which Basecamp project are not named in the export (the Basecamp bucket is `44535649`, message board `9215268341`). To be filled in.
