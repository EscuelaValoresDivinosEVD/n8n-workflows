# Cambio email-nombre

Changes a Google Workspace user's primary email address and, optionally, their first and last name. It is called over a webhook, answers the caller as soon as the email has changed, and then removes the alias Google leaves behind on the old address.

- **n8n workflow:** `Cambio email-nombre` (ID `18pwUam4ZBiPwuCa`), project Personal / Producción
- **Status at import:** Published
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

> **Draft note.** At import the editor showed unpublished changes (draft last saved 2026-09-23, published version from 2026-01-31). The JSON in this folder and this document are the published (live) version, `2908b6ab-93ef-4993-b79a-9f6b3948fe15`, taken from n8n's API instead of the canvas. The unpublished draft differs in two places:
>
> - `Webhook` path: the draft renames `5cb58ab5-2ee7-4020-be98-0ac665e594d1` to `workspace/user/nameupdate`.
> - `Edit Fields` message: the draft starts "ambio exitoso" (missing `C`) instead of "Cambio exitoso".

## Trigger

`POST /webhook/5cb58ab5-2ee7-4020-be98-0ac665e594d1` on the n8n instance (`Webhook` node, published path `5cb58ab5-2ee7-4020-be98-0ac665e594d1`).

Authentication is header auth, using the credential `Header Auth Bearer token n8n.workspace`.

The response is produced by the `Respond to Webhook` node (`responseMode: responseNode`), not by the end of the workflow.

### Request body

The body schema is not declared in the workflow; this is inferred from the expressions that read `$json.body.*`.

| Field | Required | Used for |
|---|---|---|
| `correo` | Yes | Current primary email of the user. Must look like an email and its domain must be in the `Authorized domains` data table. |
| `correoNuevo` | Yes, in practice | New primary email. See "Tricky nodes": a call without it ends in an error. |
| `nombreNuevo` | No | New first name. Skipped when empty. |
| `ApellidoNuevo` | No | New last name. Skipped when empty. Note the capital `A`. |

## What it does

1. **Pre-validation.** `Body parameters pre-validation` checks `correo` against an email regex. `Get row(s)` then looks up the domain of `correo` in the `Authorized domains` data table, and `If valid domains` passes only if a row came back. Either failure goes to `Prevalidation fails. Error message` and the workflow ends there.
2. **Look up the user.** `get User details` fetches the user by `correo` from Google Workspace (retries once after 2 s). If the lookup fails, the workflow ends in `Not found field false and debug info` or `Not found field Return message-1`.
3. **Change the first name.** `If` checks `nombreNuevo` is not empty; if so `Cambier Nombre` updates `firstName`.
4. **Change the last name.** `If1` checks `ApellidoNuevo` is not empty; if so `Cambier Apellido` updates `lastName`.
5. **Change the email.** `Cambiar email` sets `primaryEmail` to `correoNuevo`. This step always runs.
6. **Verify.** `If3` compares the `primaryEmail` Google returned with `correoNuevo`. If they differ, `Stop and Error` fails the execution with "Error, no se cambió la dirección de correo".
7. **Respond.** `Edit Fields` adds a `message` field to the updated user object and `Respond to Webhook` returns it to the caller.
8. **Clean up, after the response.** `Wait` pauses 60 (seconds, per the message returned to the caller), then `HTTP Request` sends `DELETE https://admin.googleapis.com/admin/directory/v1/users/{new email}/aliases/{old email}` to remove the old address as an alias. `Get a user` then re-reads the user by `correoNuevo`; nothing consumes its output.

### Responses

| Situation | What the caller gets |
|---|---|
| Email changed | The updated Google Workspace user object plus `message` (first incoming item of `Respond to Webhook`). |
| Validation failed, or user lookup failed | No `Respond to Webhook` node runs, so n8n sends its default response for a finished workflow. The `error`, `not_found` and `debug.*` fields built by the `Set` nodes are **not** returned. |
| Email did not change | n8n's error response, because `Stop and Error` fails the execution before any response is sent. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth Bearer token n8n.workspace` | `httpHeaderAuth` | `1sk0BlG31GVRfvCN` | `Webhook` |
| `Google Workspace admin n8n.workspace@evdsky.com` | `gSuiteAdminOAuth2Api` | `ezL6IWEZ9Wvtixxu` | `get User details`, `Cambier Nombre`, `Cambier Apellido`, `Cambiar email`, `HTTP Request`, `Get a user` |

It also reads the n8n data table `Authorized domains` (ID `rkrHk1gMjSJ6pTwu`, column `domain`).

Failed executions are reported by `Notificación de errores`, set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Cambiar email` / `If3` — `correoNuevo` is effectively mandatory.** The email update is not guarded by an `If`, unlike the name updates. A call that only wants to change a name still reaches `Cambiar email` with an empty `correoNuevo`, then fails at `If3`. By that point the name changes from steps 3–4 have already been applied, so the caller sees an error for a call that partly succeeded.
- **Error branches never reach the caller.** `Prevalidation fails. Error message`, `Not found field false and debug info` and `Not found field Return message-1` are dead ends with no `Respond to Webhook` after them. Their output is only visible in the n8n execution log.
- **`Prevalidation fails. Error message` describes a different endpoint.** Its text mentions `only_user_info`, which this workflow never reads. It looks copied from another workflow.
- **Only `correo` is validated.** `correoNuevo` is not checked for format or against `Authorized domains`.
- **`If valid domains`.** `Get row(s)` has `alwaysOutputData` on, so an unknown domain yields one empty item instead of none. The check is therefore "the first item has at least one key", not "there are items".
- **`get User details` error handling.** The node uses `onError: continueErrorOutput`, so failures leave through its second output straight to `Not found field false and debug info`. The `If get user details not contains error message` → `If not found` path on the first output checks for the same failure and is probably never taken on its false side; it looks like a leftover from before the error output was used.
- **`Wait` → `HTTP Request` runs after the caller has its answer.** The alias removal is not reflected in the response and its failure is swallowed (`onError: continueRegularOutput`, one retry after 5 s). A failed cleanup leaves the old address as an alias, with nothing reported.
- **Typos that are part of the output.** `Not found field Return message-1` writes `debug.mesage` while its sibling writes `debug.message`. Node names `Cambier Nombre` / `Cambier Apellido` are spelled that way in n8n.

## Who uses it

Not recorded in the workflow. The pinned test request was made with `curl`, which says nothing about the real caller. To be filled in.
