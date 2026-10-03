# Reporte Validación Usuarios Totales v 1

Builds an Excel file of every Google Workspace user, with their groups and delegated mailboxes, and emails it. It runs when its webhook is called.

- **n8n workflow:** `Reporte Validación Usuarios Totales v 1` (ID `WPPVOSxPaml7kWl0`), project Personal / Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

`GET /webhook/workspace/users` on the n8n instance (`Webhook` node, path `workspace/users`; no `httpMethod` is set, so n8n's default `GET` applies).

Authentication is header auth, using the credential `Header Auth Bearer token n8n.workspace`.

The response is the output of whichever node runs last (`responseMode: lastNode`, all entries), so the caller waits for the whole report to be built and sent.

### Request body

None. The workflow reads no request parameters.

## What it does

1. **Fetch all users.** `get User details` lists every Workspace user with the full projection (retries once after 2 s). On failure the workflow ends in `Not found field false and debug info`.
2. **Split into three branches per user:**
   - `Edit Fields Return Minimal User Details` keeps `email`, `firstName`, `lastName`, `orgUnitPath`, `isEnrolledIn2Sv`, `lastLoginTime`, `suspended`, `archived`, `isAdmin`.
   - `Set user email field for more details` sets `impersonate_email` to the user's address, then `Get user groups` calls `GET https://admin.googleapis.com/admin/directory/v1/groups?userKey={email}` for the user's groups.
   - The same `Set` node also feeds `Get rows on Cache Cuentas Delegadas`, which reads the `Cuentas delegadas` data table for rows where `delegateEmail` is the user. `Leave only delegated email accounts1` keeps the mailbox address and `Aggregate Delegated accounts` collects them into `delegatedEmails`.
3. **Combine.** `Merge` joins the three branches by position.
4. **Build the file.** `Convert to File` writes `Usuarios Workspace EVD {yyyy-MM-dd_HH:mm:ss}.xlsx`.
5. **Send.** `Send an Email` emails it from `n8n.workspace@evdsky.com`, subject `Usuarios Worksapce EVD`.

### Responses

| Situation | What the caller gets |
|---|---|
| Report sent | The output of `Send an Email`. |
| User listing failed | `not_found`, `correo` and `debug.*` from the `Not found…` node that ran. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth Bearer token n8n.workspace` | `httpHeaderAuth` | `1sk0BlG31GVRfvCN` | `Webhook` |
| `Google Workspace admin n8n.workspace@evdsky.com` | `gSuiteAdminOAuth2Api` | `ezL6IWEZ9Wvtixxu` | `get User details`, `Get user groups` |
| `SMTP Gmail n8n.workspace` | `smtp` | `75R3j6zFufnKWSrt` | `Send an Email` |

It also reads the n8n data table `Cuentas delegadas` (ID `0bQyjaMLc5SjLjci`), which is kept up to date by `Actualizar tabla cuentas delegadas`.

Failed executions are reported by `Notificación de errores`, set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Send an Email` — the recipients are separated by a space, not a comma.** `toEmail` is `diana.sandoval@evdsky.com mrigavyadha@evdsky.com`. Whether both people receive the report has not been checked.
- **`Aggregate Delegated accounts` collapses every user into one item.** It aggregates all incoming rows, across all users, into a single `delegatedEmails` list. `Merge` joins by position, so that one list lands on the first row of the report instead of each user getting their own.
- **`Merge` depends on row order.** It pairs items by position across three branches. `Get user groups` continues on error (`onError: continueRegularOutput`) with `alwaysOutputData` off, so a user whose group lookup returns nothing can shift every later row out of line.
- **`Get user groups` makes one API call per user** and returns at most 200 groups without following `nextPageToken`.
- **The `Not found…` nodes are leftovers from the single-user workflows.** They read `$('Webhook').item.json.body.correo`, which this endpoint never receives.
- **`Sticky Note` describes a different workflow.** Its text is about the per-user discovery.
- **Typos that are part of the output.** The subject and body say `Worksapce`.
- **Recipients are hard-coded** in the email node.

## Who uses it

The two recipients of the email; who or what calls the webhook is not recorded in the workflow. To be filled in.
