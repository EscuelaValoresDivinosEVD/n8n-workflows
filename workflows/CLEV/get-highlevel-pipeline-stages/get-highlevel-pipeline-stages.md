# Get Highlevel pipeline stages

Returns every stage of every HighLevel opportunity pipeline, with its id, name and position. It is a sub-workflow: other workflows call it, it has no webhook or schedule.

- **n8n workflow:** `Get Highlevel pipeline stages` (ID `LgDBhVqBJ1l0Zqlb`), project Personal, folder Reportes CLEV
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

`Start` (Execute Workflow Trigger, input passed through). It runs when another workflow calls it; at import the only caller is `Informe de oportunidades CLEV v2.1`, through its `Call Get pipeline stages` node.

## What it does

1. **List the pipelines.** `Get Pipelines1` calls `GET https://services.leadconnectorhq.com/opportunities/pipelines` for the CLEV location.
2. **Flatten to stages.** `split pipelines1` produces one item per pipeline and `split Stages` one item per stage.
3. **Return.** `Return` keeps `id`, `position` and `name` for each stage.

## Credentials

None. `Get Pipelines1` carries the HighLevel private integration token directly in an `Authorization` header parameter. In this repo's JSON the token is replaced with `REDACTED_HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`.

Failed executions are reported by `Notificación de errores` (ID `bPvIORzqZ5PzAIRx`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **The output does not say which pipeline a stage belongs to.** Only the stage's own `id`, `position` and `name` are returned; the caller matches stages by id.
- **`Return` writes `position` as a string.** The caller converts it back to a number in its own mapping.
- **`Get Pipelines1` runs once per incoming item,** because the trigger passes its input through.
- **Stages of "old" pipelines are included.**

## Who uses it

`Informe de oportunidades CLEV v2.1`.
