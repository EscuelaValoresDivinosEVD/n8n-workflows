# Workspaces User Discovery v1.4

Returns what a Google Workspace user has and belongs to: basic account details and, on request, admin details, shared drives, groups, delegated mailboxes, Chat spaces and Drive files. It is called over a webhook and answers with one combined object.

- **n8n workflow:** `Workspaces User Discovery v1.4` (ID `F7iA9WdhyhZ3OEId`), project Personal / Producción
- **Status at import:** Published
- **Imported:** 2026-10-03, by copying the editor canvas (clipboard export, `pinData` removed)

> **Draft note.** At import the editor showed unpublished changes (draft last saved 2026-09-23, published version from 2026-03-28). A comparison of the two versions in n8n found no difference in nodes or connections apart from canvas positions, so this JSON should behave like the published version.

## Trigger

`POST /webhook/workspace/user/details` on the n8n instance (`Webhook` node, path `workspace/user/details`).

Authentication is header auth, using the credential `Header Auth Bearer token n8n.workspace`.

The response is the output of whichever node runs last (`responseMode: lastNode`, all entries).

### Request body

The body schema is not declared in the workflow; this is inferred from the expressions that read `$json.body.*`.

| Field | Required | Used for |
|---|---|---|
| `correo` | Yes | Email of the user to look up. Must look like an email and its domain must be in the `Authorized domains` data table. |
| `moreDetails` | No | `true` adds admin flags, alternate emails and recovery contact details. |
| `sharedDrives` | No | `true` adds the shared drives the user can see. |
| `groups` | No | `true` adds the groups the user belongs to. |
| `delegated` | No | `true` adds the mailboxes delegated to the user. |
| `spaces` | No | `true` adds the user's Chat spaces and group chats. |
| `driveFiles` | No | `true` adds the Drive file sections (three keys, see below). |

The six flags are compared strictly with the boolean `true`. A missing flag, `"true"` as a string, or `1` all count as off.

## What it does

1. **Pre-validation.** `Body parameters pre-validation` checks `correo` against an email regex. `Get row(s)` looks up the domain in the `Authorized domains` data table, and `If valid domains` passes only if a row came back. Either failure ends in `Prevalidation fails. Error message`.
2. **Look up the user.** `get User details` fetches the user by `correo` (retries once). If the lookup fails, the workflow ends in `Not found field false and debug info` or `Not found field Return message-1`.
3. **Basic details, always.** `Edit Fields Return Minimal User Details` keeps `email`, `firstName`, `lastName`, `orgUnitPath`, `suspended`, `archived`, `isEnrolledIn2Sv`.
4. **Optional sections.** `Set user email field for more details` sets `impersonate_email` to the user's address and fans out to six `If` nodes, one per flag:
   - **`moreDetails`** — `Edit Fields User Details` builds `moreDetails.*`: `workspaces_id`, `kind`, `isAdmin`, `isDelegatedAdmin`, `suspended`, `archived`, `emails`, `recoveryEmail`, `recoveryPhone`.
   - **`sharedDrives`** — `Direct Shared drives` lists shared drives with the service account; `Aggregate` collects them under `saredDrives`.
   - **`groups`** — `Get user groups` calls `GET https://admin.googleapis.com/admin/directory/v1/groups?userKey={email}`.
   - **`delegated`** — `Get rows on Cache Cuentas Delegadas` reads the `Cuentas delegadas` data table for rows where `delegateEmail` is the user; the mailboxes are collected under `delegatedEmails`.
   - **`spaces`** — `Listar Chats` calls `GET https://chat.googleapis.com/v1/spaces` filtered to spaces and group chats; `Split Out`, `Chats (Espacios)` and `Aggregate spaces` reduce them to a `spaces` list.
   - **`driveFiles`** — `get all files-folders` lists every non-trashed file and folder with all fields, and `Edit Fields` trims each one. Three results come out of it:
     - `sharedToUser`: shared with the user and not owned by them (`Filter shared_with_me`).
     - `sharedByUser`: owned by the user and shared, with permissions (`Owned and shared by User`).
     - `inSharedDrivesOwnedByUser`: owned by the user and sitting in a shared drive, with the drive's name added (`En unidad compartida propiedad del usuario` → `Get shared drive names` → `Merge1`).
5. **Combine.** `Merge` joins its nine inputs by position into one item, which is the webhook response.

### Responses

| Situation | What the caller gets |
|---|---|
| User found | One object with the basic details plus a key for each section requested. |
| Validation failed | `error` with the text built by `Prevalidation fails. Error message`. |
| User lookup failed | `not_found`, `correo` and the `debug.*` fields from the `Not found…` node that ran. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth Bearer token n8n.workspace` | `httpHeaderAuth` | `1sk0BlG31GVRfvCN` | `Webhook` |
| `Google Workspace admin n8n.workspace@evdsky.com` | `gSuiteAdminOAuth2Api` | `ezL6IWEZ9Wvtixxu` | `get User details`, `Get user groups` |
| `Google Service Account n8n.workspace` | `googleApi` | `lD2x8tufXSCQ77B3` | `Listar Chats`, `Direct Shared drives`, `get all files-folders`, `Get shared drive names` |

It also reads two n8n data tables: `Authorized domains` (ID `rkrHk1gMjSJ6pTwu`) and `Cuentas delegadas` (ID `0bQyjaMLc5SjLjci`), the second kept up to date by `Actualizar tabla cuentas delegadas`.

Failed executions are reported by `Notificación de errores`, set as this workflow's error workflow in n8n.

## Tricky nodes

- **`impersonate_email` decides whose data the service account sees.** The service-account nodes carry no user in their own parameters; they appear to act as whoever `impersonate_email` names. `Set user email field for more details` sets it to the user being looked up, and `Agregar impersonate email` switches it to `n8n.workspace@evdsky.com` so that `Get shared drive names` can read drive names with domain admin access. The credential's configuration is not part of the export, so this mechanism is inferred from the node names.
- **`Merge` — nine inputs, most of them optional.** Inputs are, in order: basic details, `moreDetails`, `saredDrives`, groups, `delegatedEmails`, `spaces`, `sharedToUser`, `sharedByUser`, `inSharedDrivesOwnedByUser`. Branches whose flag is off never deliver anything, and the workflow relies on `Merge` still running with the inputs that did arrive.
- **`get all files-folders` is the slow part.** It requests every non-trashed file with `fields: *`, and the webhook does not answer until it finishes. It continues on error, so a failed listing returns a response without the three file sections instead of an error.
- **`Impersonate Workspade admin` does not impersonate anything.** It is a `Set` node that copies file fields (as strings) before `Merge1`.
- **`Get user groups` returns at most 200 groups** and does not follow `nextPageToken`.
- **`Prevalidation fails. Error message` describes the wrong body.** It mentions `only_user_info`, which this workflow never reads, and none of the six real flags.
- **`If valid domains`.** `Get row(s)` has `alwaysOutputData` on, so an unknown domain yields one empty item. The check is "the first item has at least one key".
- **`get User details` error handling.** Failures leave through the node's error output straight to `Not found field false and debug info`. The `If get user details not contains error message` → `If not found` path on the first output is probably never taken on its false side.
- **Typos that are part of the output.** The shared drives key is `saredDrives`, `Not found field Return message-1` writes `debug.mesage`, and `isEnrolledIn2Sv` is returned as a string.
- **The flag `If` nodes are named inconsistently.** `If moreDetails True1` and plain `If` (the `driveFiles` check) sit alongside `If groups True`, `If delegated True`, `If spaces True` and `If sharedDrives True`.

## Who uses it

Not recorded in the workflow. The `Sticky Note` on the canvas describes the intent: asking n8n which groups a person is in, what privileges they have in the Workspace, and which shared drives and delegated mailboxes they have. To be filled in.
