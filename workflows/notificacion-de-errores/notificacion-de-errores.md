# Notificación de errores

Sends an email whenever another workflow fails. It is the shared error handler for the EVD workflows, not something that is called directly.

- **n8n workflow:** `Notificación de errores` (ID `3zIsIk79vmEx0sM9`), project Personal / Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

`Error Trigger`. n8n runs this workflow when a workflow that names it as its error workflow fails.

At import, the other six published workflows all had it set as their error workflow in their n8n settings: `Cambio email-nombre`, `Workspaces User Discovery v1.4`, `Reporte Validación Usuarios Totales v 1`, `Reporte Validación Usuarios Activos v 1.1`, `Actualizar tabla cuentas delegadas` and `Suspender cuenta Workspace v1.0`. That setting lives in each workflow's settings, which a clipboard export does not include.

## What it does

1. `Error Trigger` receives the failed execution's details.
2. `Send email` sends a plain-text email from `n8n.workspace@evdsky.com` to `servidores@evdsky.com` with the subject `Error en workflow n8n.workspaces: {workflow name}`. The body lists the workflow name, execution URL, last node executed, error message, execution mode, execution ID and stack trace.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `SMTP Gmail n8n.workspace` | `smtp` | `75R3j6zFufnKWSrt` | `Send email` |

## Tricky nodes

- **`Send email` — the execution URL only opens over the VPN.** The email body says so ("Debe estar conectado a la VPN para acceder al URL").
- **`Send email` — "Message" and "Error" print the same value.** Both lines use `$json.execution.error.message`.
- **Only failed executions arrive here.** Webhook workflows that end on a validation branch finish successfully, so they do not trigger this email.

## Who uses it

Whoever reads `servidores@evdsky.com`. To be filled in.
