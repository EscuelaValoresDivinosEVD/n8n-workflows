# Actualizar tabla cuentas delegadas

Keeps the n8n data table `Cuentas delegadas` in step with the real Gmail delegations. For every mailbox in the `/Cuentas Delegadas` organisational unit it reads who the delegates are, then adds the missing rows to the table and deletes the stale ones.

- **n8n workflow:** `Actualizar tabla cuentas delegadas` (ID `aZOpmxUV0OgLaCxV`), project Personal / Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

- `Schedule Trigger`: the rule is left at its defaults (`interval: [{}]`), which in n8n means once a day at midnight, in the instance's timezone.
- `Webhook`: `GET /webhook/ee552566-6908-40e1-a58f-a496562425ce` (no `httpMethod` is set, so n8n's default `GET` applies). Header auth with the credential `Header Auth Bearer token n8n.workspace`. No `responseMode` is set, so n8n answers immediately and the sync runs afterwards.
- `When clicking ‘Execute workflow’`: manual run from the editor.

### Request body

None. The workflow reads no request parameters.

## What it does

1. **List the delegated mailboxes.** `Get users from OU Cuentas Delegadas` lists the `primaryEmail` of every user where `orgUnitPath='/Cuentas Delegadas'` (retries once after 2 s).
2. **Read each mailbox's delegates.** `Set impersonate email for service account credential` puts the mailbox address in `impersonate_email`, and `Get Gmail delegates` calls `GET https://gmail.googleapis.com/gmail/v1/users/{mailbox}/settings/delegates`.
3. **Flatten.** `Split Out` produces one item per delegate and `Edit Fields` reduces it to `email` (the mailbox) and `delegateEmail`.
4. **Read the current table.** In parallel, `Get row(s)` reads every row of `Cuentas delegadas`.
5. **Compare.** `To insert` keeps the pairs found in Gmail but not in the table. `To delete` keeps the table rows no longer found in Gmail. Both match on `email` and `delegateEmail`.
6. **Apply.** `If` → `Insert row` adds the new pairs. `If1` → `Delete row(s)` removes the stale rows by `id`.
7. **Summarise.** `Aggregate` and `Aggregate1` collect the results into `rowsAdded` and `rowsDeleted`. Nothing reads them afterwards.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth Bearer token n8n.workspace` | `httpHeaderAuth` | `1sk0BlG31GVRfvCN` | `Webhook` |
| `Google Workspace admin n8n.workspace@evdsky.com` | `gSuiteAdminOAuth2Api` | `ezL6IWEZ9Wvtixxu` | `Get users from OU Cuentas Delegadas` |
| `Google Service Account n8n.workspace` | `googleApi` | `lD2x8tufXSCQ77B3` | `Get Gmail delegates` |

It reads and writes the n8n data table `Cuentas delegadas` (ID `0bQyjaMLc5SjLjci`, columns `email` and `delegateEmail`).

Failed executions are reported by `Notificación de errores`, set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Get Gmail delegates` — a failed read can look like "no delegates".** The node has `neverError` on, so an API error for a mailbox returns a body without `delegates` instead of failing. Those mailboxes then contribute nothing, and `To delete` treats their existing table rows as stale. An outage on the Gmail API could therefore empty the table.
- **`Set impersonate email for service account credential` — the field name matters.** The service account credential has to act as each mailbox to read its settings. The node name says the credential picks the address up from `impersonate_email`; the credential's own configuration is not part of the export, so this is not confirmed here.
- **`To insert` and `To delete` are the same `Merge` configured in opposite directions.** Both use `keepNonMatches`; `To insert` outputs from input 1 (Gmail) and `To delete` from input 2 (the table). The input order on the canvas is what makes it correct.
- **`If` / `If1` test for an empty item, not an empty list.** The merges have `alwaysOutputData` on, so "nothing to do" arrives as one empty item. The check is "the first item has at least one key".
- **`Delete row(s)` has no column name in its filter.** The condition only carries the value `$json.id`; it relies on the node's default key.
- **`Get row(s)` runs once** (`executeOnce`), whichever trigger started the run.
- **`Get users from OU Cuentas Delegadas` error output is not connected.** A failed listing ends the run without changes and without an error notification.
- **The webhook path is a generated UUID**, unlike the readable paths on the other workflows.

## Who uses it

No person calls it in normal operation; it runs on its schedule. Its output, the `Cuentas delegadas` table, is read by `Workspaces User Discovery v1.4` and `Reporte Validación Usuarios Totales v 1`.
