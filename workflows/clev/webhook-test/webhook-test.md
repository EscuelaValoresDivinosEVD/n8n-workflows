# Webhook test

A two-node test workflow: a webhook followed by a wait. It does nothing else and looks like a leftover from trying out webhook authentication, but it is published, so its endpoint is live.

- **n8n workflow:** `Webhook test` (ID `kG0K7l8uzyeGfDtr`), project Personal
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

`POST /webhook/test` on the n8n instance (`Webhook` node, path `test`).

Authentication is header auth, using the credential `TEst`.

The response is the output of whichever node runs last (`responseMode: lastNode`).

### Request body

None. The workflow reads no request parameters.

## What it does

1. `Webhook` receives the request.
2. `Wait` pauses with its default settings, then the workflow ends and the webhook answers.

### Responses

| Situation | What the caller gets |
|---|---|
| Any call with valid auth | The output of `Wait`, which is the incoming request passed through. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `TEst` | `httpHeaderAuth` | `MSFyaEGhJz40Ri79` | `Webhook` |

Failed executions are reported by `Notificación de errores` (ID `bPvIORzqZ5PzAIRx`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Wait` has no parameters set,** so how long it pauses depends on the node's defaults. Not checked against an execution.
- **The endpoint echoes the request back,** headers included, to anyone holding the `TEst` credential's secret.

## Who uses it

Nobody, as far as the workflow shows. To be confirmed: whether it can be unpublished.
