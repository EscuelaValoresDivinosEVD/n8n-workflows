# Notificación de errores

Sends an email whenever another workflow fails. It is the shared error handler for the CLEV reporting workflows, not something that is called directly. A separate workflow with the same name does the same job for the Google Workspace workflows.

- **n8n workflow:** `Notificación de errores` (ID `bPvIORzqZ5PzAIRx`), project Personal
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, read from n8n's API (the canvas copy came back empty; no `pinData`)

## Trigger

`Error Trigger`. n8n runs this workflow when a workflow that names it as its error workflow fails.

At import, six published workflows had it set as their error workflow in their n8n settings: `Informe de oportunidades CLEV v2.1`, `Crear menú reportes CLEV`, `Get menu from CRM`, `Get Highlevel pipelines names and ids`, `Get Highlevel pipeline stages` and `Webhook test`. That setting lives in each workflow's settings, which a clipboard export does not include.

## What it does

1. `Error Trigger` receives the failed execution's details.
2. `Send email` sends a plain-text email from `auto@clev.org` to `servidores@evdsky.com` with the subject `Error en workflow n8n: {workflow name}`. The body lists the workflow name, execution URL, last node executed, execution mode, execution ID, error message and stack trace.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `SMTP account` | `smtp` | `ylQOhGrhT90sFcGN` | `Send email` |

## Tricky nodes

- **`Send email` rewrites the execution URL.** It replaces `https://auto.evdsky.com` with an internal IP address, so the link in the email points at the server directly and only opens over the VPN (the body says so: "Debe estar conectado a la VPN para acceder al URL").
- **Only failed executions arrive here.** A workflow that finishes without an error, even with nothing useful done, does not trigger this email.

## Who uses it

Whoever reads `servidores@evdsky.com`. To be filled in.
