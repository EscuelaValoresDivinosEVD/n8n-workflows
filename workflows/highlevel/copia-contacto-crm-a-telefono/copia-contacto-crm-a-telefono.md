# Copia contacto CRM a teléfono

A single webhook node with nothing connected after it. The name says it should copy a CRM contact to a phone, but no such logic exists: the endpoint accepts a call and does nothing.

- **n8n workflow:** `Copia contacto CRM a teléfono` (ID `r72hFgKdvXh3zP90`), project Personal
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

`POST /webhook/694daab8-7fcb-487e-b550-e93ffbdda182` on the n8n instance (`Webhook` node; the path is a generated id).

Authentication is header auth. The node shows the credential as `Header Auth account`; it has the same n8n ID as `Header Auth n8n.highlevel`, so it is that credential under an earlier name.

No `responseMode` is set, so n8n answers immediately.

### Request body

None. The workflow reads no request parameters.

## What it does

1. `Webhook` receives the request. Nothing else runs.

### Responses

| Situation | What the caller gets |
|---|---|
| Any call with valid auth | n8n's immediate "workflow started" response. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth account` (now `Header Auth n8n.highlevel`) | `httpHeaderAuth` | `psZv93SrO3IkUx5T` | `Webhook` |

Failed executions are reported by `Notificación de errores` (ID `RFQhLaxt4mH5fioB`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **It is a stub.** The workflow is published with only its trigger, so callers get a success response while nothing happens.
- **The credential name on the node is stale.** n8n stores the display name at the time the node was saved.

## Who uses it

Not recorded in the workflow. To be confirmed: whether anything calls it, and whether it is unfinished work or can be unpublished.
