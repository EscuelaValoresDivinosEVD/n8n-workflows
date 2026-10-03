# Reporte Validación Usuarios Activos v 1.1

Emails a CSV of active Google Workspace accounts that are not enrolled in 2-step verification. It runs on a schedule twice a week.

- **n8n workflow:** `Reporte Validación Usuarios Activos v 1.1` (ID `04HnGblIwsogMxTr`), project Personal / Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

- `Schedule Trigger`: weekly, on Wednesday and Friday at 09:00 (`triggerAtDay: [3, 5]`, `triggerAtHour: 9`), in the instance's timezone.
- `When clicking ‘Execute workflow’`: manual run from the editor.

There is no webhook.

## What it does

1. **Fetch all users.** `get User details` lists every Workspace user with the full projection (retries once after 2 s).
2. **Keep the report fields.** `Edit Fields` keeps `primaryEmail`, `fullName`, `creationTime`, `lastLoginTime`, `suspended`, `orgUnitPath`, `isEnrolledIn2Sv` and `isAdmin`.
3. **Filter by status.** `If` keeps accounts where `suspended` is false and `isEnrolledIn2Sv` is false.
4. **Filter by organisational unit.** `If1` drops accounts in the root unit (`/`) and any unit whose path contains `Delegadas`, `pruebas` or `inactivas` (case-insensitive).
5. **Flag accounts that never logged in.** `If2` compares `lastLoginTime` with `creationTime`. Equal goes to `Edit Fields2` (`neverLoggedIn: true`), otherwise to `Edit Fields1` (`neverLoggedIn: false`).
6. **Build the file.** `Convert to File` writes a CSV named `cuentas_inactivas_workspaces_{YYYY-MM-DD}.csv`.
7. **Send.** `Send email to Mrigavyadha y Diana` emails it from `n8n.workspace@evdsky.com` to `mrigavyadha@evdsky.com` and `diana.sandoval@evdsky.com`, subject `Cuentas inactivas Workspaces EVD {YYYY-MM-DD}`.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Google Workspace admin n8n.workspace@evdsky.com` | `gSuiteAdminOAuth2Api` | `ezL6IWEZ9Wvtixxu` | `get User details` |
| `SMTP Gmail n8n.workspace` | `smtp` | `75R3j6zFufnKWSrt` | `Send email to Mrigavyadha y Diana` |

Failed executions are reported by `Notificación de errores`, set as this workflow's error workflow in n8n.

## Tricky nodes

- **The name, the file and the filter say three different things.** The workflow is called "Usuarios Activos", the file and subject say "cuentas inactivas", and the filter in `If` actually selects active accounts without 2-step verification.
- **`If2` — "never logged in" is a date comparison.** It treats an account as never logged in when `lastLoginTime` equals `creationTime`, with loose type validation. Whether Google ever returns equal values there has not been checked; if it does not, every row gets `neverLoggedIn: false`.
- **`Convert to File` has two incoming branches.** `Edit Fields1` and `Edit Fields2` both feed it. When both branches have rows, it probably runs once per branch, giving two CSV files and two emails per run. Not verified against an execution.
- **`If` and `If1` have no false branch.** Accounts that fail a filter are dropped silently.
- **`get User details` error output is not connected.** With `onError: continueErrorOutput`, a failed listing ends the run without an email and without an error notification.
- **Recipients are hard-coded** in the email node and in its name.

## Who uses it

The two recipients of the email. To be filled in with their roles.
