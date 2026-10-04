# Notificación de errores

Sends an email whenever another workflow fails. It is the shared error handler for the HighLevel workflows, not something that is called directly. Separate workflows with the same name do the same job for the Google Workspace and CLEV areas.

- **n8n workflow:** `Notificación de errores` (ID `RFQhLaxt4mH5fioB`), project Personal, folder Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

`Error Trigger`. n8n runs this workflow when a workflow that names it as its error workflow fails.

At import, seven published workflows had it set as their error workflow in their n8n settings: `Actualizar campo Comunidad WhatsApp auto COL`, `Actualizar tabla cache custom fields highlevel`, `Actualizar tabla cache iniciados - iniciado actualizado desde PI`, `Upsert Contacts from Iniciados to Sedes`, `Sub. Upsert contact by email multi credential Iniciados Sedes`, `Sub. Search all contacts by Sede Location ID multi credential` and `Copia contacto CRM a teléfono`. Two had none: `Search contact email multi credential` and `test webhook events Iniciados`.

## What it does

1. `Error Trigger` receives the failed execution's details.
2. `Send email` sends a plain-text email from `n8n@evdsky.com` to `servidores@evdsky.com` with the subject `Error en workflow n8n.highlevel: {workflow name}`. The body lists the workflow name, execution URL, last node executed, execution mode, execution ID, error message and stack trace.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `SMTP account 3` | `smtp` | `SQxav0N7jHb6SzMH` | `Send email` |

## Tricky nodes

- **`Send email` rewrites the execution URL.** It replaces `https://auto.evdsky.com` with an internal IP address, so the link in the email points at the server directly and only opens over the VPN (the body says so: "Debe estar conectado a la VPN para acceder al URL").
- **Only failed executions arrive here.** Several HighLevel workflows continue on error (`onError: continueRegularOutput`), so a failed API call inside them does not produce this email.

## Who uses it

Whoever reads `servidores@evdsky.com`. To be filled in.
