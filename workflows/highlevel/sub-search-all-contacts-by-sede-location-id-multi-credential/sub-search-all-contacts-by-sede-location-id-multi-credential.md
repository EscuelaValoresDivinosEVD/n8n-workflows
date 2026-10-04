# Sub. Search all contacts by Sede Location ID multi credential

Returns every contact of one sede's HighLevel account. It is a sub-workflow: other workflows call it, it has no webhook or schedule. Only the Argentina and Chile branches are active.

- **n8n workflow:** `Sub. Search all contacts by Sede Location ID multi credential` (ID `EgunDnFlOCV15lg1`), project Personal
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

`When Executed by Another Workflow` (Execute Workflow Trigger) with two inputs: `sede` and `locationIdSede`. None of the other imported workflows calls it.

## What it does

1. **Route by sede.** `Switch` has one output per sede, each leading to a `Get All Contacts <sede>` node with that sede's credential.
2. **Fetch all contacts.** The node calls `GET https://services.leadconnectorhq.com/contacts/?locationId={locationIdSede}&limit=100` and follows HighLevel's `startAfter` / `startAfterId` cursor until there are no more pages.
3. **Return.** `Merge` appends the Argentina and Chile results.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Bearer Auth Argentina Highlevel` | `httpBearerAuth` | `buxNC8ku50XFzgM7` | `Get All Contacts Argentina` |
| `Bearer Auth Chile Highlevel` | `httpBearerAuth` | `sMIB4Sb2W4MzBC2J` | `Get All Contacts Chile` |

The other eleven `Get All Contacts…` nodes are disabled; they carry the Colombia, Costa Rica, Cuenca, España, Italia, México, Online, Perú, Quito, Uruguay and Venezuela credentials (IDs as listed in `Sub. Upsert contact by email multi credential Iniciados Sedes`).

Failed executions are reported by `Notificación de errores` (ID `RFQhLaxt4mH5fioB`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **Eleven of the thirteen branches are disabled and not connected to `Merge`.** A call for any sede other than Argentina or Chile returns nothing.
- **Error handling differs between the two live branches.** `Get All Contacts Chile` continues on error; `Get All Contacts Argentina` does not, so only an Argentina failure stops the run.
- **`Merge` waits for both inputs in principle,** but a call names one sede, so only one branch ever has data. It relies on n8n running the merge with a single input.
- **Pagination ends on a missing `startAfterId`.** If HighLevel changes that field, the node either stops after one page or never stops.

## Who uses it

Nothing among the imported workflows. It looks like unfinished work. To be confirmed.
