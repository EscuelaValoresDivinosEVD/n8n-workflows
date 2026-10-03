# Suspender cuenta Workspace v1.0

Suspends a Google Workspace user account. It is called over a webhook with the user's email address.

- **n8n workflow:** `Suspender cuenta Workspace v1.0` (ID `pFPawAmOscPBnNYN`), project Personal / Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

## Trigger

`POST /webhook/workspace/user/suspend` on the n8n instance (`Webhook` node, path `workspace/user/suspend`).

Authentication is header auth, using the credential `Header Auth Bearer token n8n.workspace`.

The response is the output of whichever node runs last (`responseMode: lastNode`, all entries).

### Request body

The body schema is not declared in the workflow; this is inferred from the expressions that read `$json.body.*`.

| Field | Required | Used for |
|---|---|---|
| `correo` | Yes | Email of the account to suspend. Must look like an email and its domain must be in the `Authorized domains` data table. |

## What it does

1. **Pre-validation.** `Body parameters pre-validation` checks `correo` against an email regex. `Get row(s)` looks up the domain of `correo` in the `Authorized domains` data table, and `If valid domains` passes only if a row came back. Either failure ends in `Prevalidation fails. Error message`.
2. **Look up the user.** `get User details` fetches the user by `correo` (retries once after 2 s). If the lookup fails, the workflow ends in `Not found field false and debug info` or `Not found field Return message-1`.
3. **Suspend.** `Suspender Cuenta` sends `PUT https://admin.googleapis.com/admin/directory/v1/users/{correo}` with `suspended` set to `true`.

### Responses

| Situation | What the caller gets |
|---|---|
| Account suspended | The Google Workspace user object returned by the `PUT`. |
| Validation failed | `error` with the text built by `Prevalidation fails. Error message`. |
| User lookup failed | `not_found`, `correo` and the `debug.*` fields from the `Not found…` node that ran. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth Bearer token n8n.workspace` | `httpHeaderAuth` | `1sk0BlG31GVRfvCN` | `Webhook` |
| `Google Workspace admin n8n.workspace@evdsky.com` | `gSuiteAdminOAuth2Api` | `ezL6IWEZ9Wvtixxu` | `get User details`, `Suspender Cuenta` |

It also reads the n8n data table `Authorized domains` (ID `rkrHk1gMjSJ6pTwu`, column `domain`).

Failed executions are reported by `Notificación de errores`, set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Suspender Cuenta` is a raw HTTP call, not the Google Workspace Admin node.** It sends `suspended` as the string `"true"` in the body parameters and relies on Google accepting it.
- **No check for the account's current state.** An account that is already suspended is sent the same `PUT` again.
- **Errors come back as normal responses.** Validation and not-found branches finish successfully, so the caller has to read the body (`error`, `not_found`) to know nothing was suspended.
- **`Prevalidation fails. Error message` describes a different endpoint.** Its text mentions `only_user_info`, which this workflow never reads.
- **`If valid domains`.** `Get row(s)` has `alwaysOutputData` on, so an unknown domain yields one empty item. The check is "the first item has at least one key".
- **`get User details` error handling.** Failures leave through the node's error output straight to `Not found field false and debug info`. The `If get user details not contains error message` → `If not found` path on the first output is probably never taken on its false side.
- **`debug.mesage` typo.** `Not found field Return message-1` writes `debug.mesage`; its sibling writes `debug.message`.

## Who uses it

Not recorded in the workflow. To be filled in.
