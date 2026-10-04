# test webhook events Iniciados

A single webhook node with nothing connected after it. It looks like a test endpoint for receiving events from the Iniciados HighLevel account: calls are accepted and can be inspected in n8n's execution log, but nothing is done with them.

- **n8n workflow:** `test webhook events Iniciados` (ID `rhK-ZImfQftgwTTNxKp7y`), project Personal
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

`POST /webhook/615a78c5-96e9-4c21-b85f-a61fb47adc7e` on the n8n instance (`Webhook` node; the path is a generated id).

Authentication is header auth, using the credential `Header Auth n8n.highlevel`.

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
| `Header Auth n8n.highlevel` | `httpHeaderAuth` | `psZv93SrO3IkUx5T` | `Webhook` |

No error workflow is set for this workflow.

## Tricky nodes

- **It is a stub.** The workflow is published with only its trigger.

## Who uses it

Not recorded in the workflow. To be confirmed: whether HighLevel still sends events to it, and whether it can be unpublished.
