# Get Highlevel pipelines names and ids

Returns the id and name of every HighLevel opportunity pipeline. It is a sub-workflow: other workflows call it, it has no webhook or schedule.

- **n8n workflow:** `Get Highlevel pipelines names and ids` (ID `IVSIzc3DronQ0daD`), project Personal, folder Reportes CLEV
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

`Start` (Execute Workflow Trigger, input passed through). It runs when another workflow calls it; at import the only caller is `Informe de oportunidades CLEV v2.1`, through its `Call Get Highlevel pipelines names and ids` node.

## What it does

1. **List the pipelines.** `Get Pipelines1` calls `GET https://services.leadconnectorhq.com/opportunities/pipelines` for the CLEV location.
2. **Flatten.** `split pipelines1` produces one item per pipeline, and `split Pipeline ids names` keeps only `id` and `name`.

## Credentials

None. `Get Pipelines1` carries the HighLevel private integration token directly in an `Authorization` header parameter. In this repo's JSON the token is replaced with `REDACTED_HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`.

Failed executions are reported by `Notificación de errores` (ID `bPvIORzqZ5PzAIRx`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Get Pipelines1` runs once per incoming item.** The trigger passes its input through, so a caller that sends several items gets the pipeline list repeated for each.
- **It returns every pipeline,** including the ones with "old" in their name; the caller filters those out.
- **The same request is duplicated** in `Get Highlevel pipeline stages` and `Crear menú reportes CLEV`, each with its own copy of the token.

## Who uses it

`Informe de oportunidades CLEV v2.1`.
