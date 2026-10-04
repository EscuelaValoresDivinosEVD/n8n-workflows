# Get menu from CRM

Reads the report menu stored in HighLevel and returns it as rows of number and pipeline name. It is a sub-workflow: other workflows call it, it has no webhook or schedule.

- **n8n workflow:** `Get menu from CRM` (ID `YXnUzdYbCiopgUjI`), project Personal, folder Reportes CLEV
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

`Start` (Execute Workflow Trigger). It runs when another workflow calls it; at import the only caller is `Informe de oportunidades CLEV v2.1`, through its `Call Get menu from crm` node.

It declares one input, `body_customData_selection_toNumber`, which nothing in the workflow reads.

## What it does

1. **Read the custom values.** `Get Custom Values` calls `GET https://services.leadconnectorhq.com/locations/{location}/customValues`, and `Split Out3` produces one item per custom value.
2. **Pick the menu.** `seleccionar campo con menú en el CRM` keeps the custom value keyed `menu_reportes_automaticos`.
3. **Parse it.** `Generate table Indexes and pipelines names` reads the menu text, finds every `(number)` marker and returns one item per entry with `index` and `name`.

## Credentials

None. `Get Custom Values` carries the HighLevel private integration token directly in an `Authorization` header parameter. In this repo's JSON the token is replaced with `REDACTED_HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`.

Failed executions are reported by `Notificación de errores` (ID `bPvIORzqZ5PzAIRx`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Generate table Indexes and pipelines names` depends on the menu's exact format.** It expects the text written by `Crear menú reportes CLEV` (`_*(0)*_ Todos _*| (1)*_ {name} …`): a name is whatever sits between one `(number)` and the next, with surrounding spaces, underscores, asterisks and pipes stripped. A pipeline name containing a number in parentheses would be split in two.
- **`seleccionar campo con menú en el CRM` compares against HighLevel's key syntax.** The right-hand value `{{ custom_values.menu_reportes_automaticos }}` is plain text, not an n8n expression.
- **The declared input is unused,** and the caller passes nothing for it.

## Who uses it

`Informe de oportunidades CLEV v2.1`.
