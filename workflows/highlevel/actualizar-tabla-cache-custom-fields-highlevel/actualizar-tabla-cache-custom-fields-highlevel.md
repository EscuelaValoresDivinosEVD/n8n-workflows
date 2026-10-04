# Actualizar tabla cache custom fields highlevel

Rebuilds the n8n data table `CustomFieldsHighLevel`, a cache of every custom field in every HighLevel account. For each account it fetches the custom fields, then replaces the table's contents with the fresh list.

- **n8n workflow:** `Actualizar tabla cache custom fields highlevel` (ID `4YH0U5vnXc31bLKW`), project Personal, folder Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

- `Schedule Trigger`: the rule is left at its defaults (`interval: [{}]`), which in n8n means once a day at midnight, in the instance's timezone.
- `When clicking ‘Execute workflow’`: manual run from the editor.
- `Webhook`: a `POST` webhook with header auth is on the canvas but **disabled**, so it exposes no endpoint.

## What it does

1. **Read the accounts.** `Get row(s) tabla LocationIDs` reads the data table `HighLevel_Location_IDs`: one row per account with its `sede` name and `locationId`.
2. **Route by account.** `Switch` sends each row to the branch for its `sede`. There are 16 branches: Global, Iniciados, CLEV and the 13 sedes (Argentina, Chile, Colombia, Costa Rica, Cuenca, España, Italia, México, Online, Perú, Quito, Uruguay and Venezuela).
3. **Fetch the custom fields.** Each branch has its own `Get Custom Fields <account>` node calling `GET https://services.leadconnectorhq.com/locations/{locationId}/customFields` with that account's credential.
4. **Label and flatten.** Each branch's `Edit Fields…` node adds `locationName`, and its `Split Out…` node produces one item per custom field.
5. **Combine.** `Merge`, `Merge1` and `Merge2` append all branches into one list, and `New fields` reduces each item to `customFieldName`, `customFieldId`, `customFieldFieldKey`, `sede` and `locationId`.
6. **Replace the table.** `Obtener filas exisitentes` reads the current rows of `CustomFieldsHighLevel`, `Borrar filas existentes` deletes them, and once that has finished `Merge3` lets the new list through to `Escribir filas nuevas`, which inserts it.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Bearer Auth Global Highlevel` | `httpBearerAuth` | `O5VIrmRZ8U44X95T` | `Get Custom Fields Global` |
| `Bearer Auth Iniciados Highlevel` | `httpBearerAuth` | `IQy6TekEHKezE5le` | `Get Custom Fields Iniciados` |
| `Bearer Auth CLEV Highlevel` | `httpBearerAuth` | `tvmGpAGQxvZ0c6Ho` | `Get Custom Fields CLEV` |
| `Bearer Auth Argentina Highlevel` | `httpBearerAuth` | `buxNC8ku50XFzgM7` | `Get Custom Fields Argentina` |
| `Bearer Auth Chile Highlevel` | `httpBearerAuth` | `sMIB4Sb2W4MzBC2J` | `Get Custom Fields Chile` |
| `Bearer Auth Colombia Highlevel` | `httpBearerAuth` | `PyXklTRTJY2dAosR` | `Get Custom Fields Colombia` |
| `Bearer Auth Costa Rica Highlevel` | `httpBearerAuth` | `F5AOajTCo9EG5COw` | `Get Custom Fields Costa Rica` |
| `Bearer Auth Cuenca Highlevel` | `httpBearerAuth` | `P47VMvRcYpWJSNXH` | `Get Custom Fields Cuenca` |
| `Bearer Auth España Highlevel` | `httpBearerAuth` | `a0DW5j5LJGDPDXXn` | `Get Custom Fields España` |
| `Bearer Auth Italia Highlevel` | `httpBearerAuth` | `MO0Qxn2BYYhStBMD` | `Get Custom Fields Italia` |
| `Bearer Auth México Highlevel` | `httpBearerAuth` | `ltwVsPHswYrZeOFR` | `Get Custom Fields México` |
| `Bearer Auth Online Highlevel` | `httpBearerAuth` | `ww8M8639TJUuQ7lW` | `Get Custom Fields Online` |
| `Bearer Auth Perú Highlevel` | `httpBearerAuth` | `oYaQzJfTFJ22vAib` | `Get Custom Fields Perú` |
| `Bearer Auth Quito Highlevel` | `httpBearerAuth` | `fgQLqrKHTsgXIR5l` | `Get Custom Fields Quito` |
| `Bearer Auth Uruguay Highlevel` | `httpBearerAuth` | `h1YF0ou8b82NIm5L` | `Get Custom Fields Uruguay` |
| `Bearer Auth Venezuela Highlevel` | `httpBearerAuth` | `KdOIB7khZGmkiiio` | `Get Custom Fields Venezuela` |
| `Header Auth n8n.highlevel` | `httpHeaderAuth` | `psZv93SrO3IkUx5T` | `Webhook` (disabled) |

It reads the data table `HighLevel_Location_IDs` (ID `p5K85zArH4y1XQ61`) and rewrites `CustomFieldsHighLevel` (ID `dnPzVbYwHPI3hP3B`).

Failed executions are reported by `Notificación de errores` (ID `RFQhLaxt4mH5fioB`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **One branch per account exists because each HighLevel account has its own token.** n8n cannot pick a credential from data, so `Switch` routes each row to a node that has the right credential attached. Adding an account means adding a `Switch` rule, a credential and a four-node branch.
- **`Escribir filas nuevas` writes the field id into `customFieldKey`.** Both the `customFieldKey` and `customFieldId` columns are filled from `customFieldId`; the real key (`customFieldFieldKey`) is computed by `New fields` but never written. Workflows that read `customFieldKey` from this table get the id instead.
- **The table is emptied before it is refilled.** If the insert fails after `Borrar filas existentes` has run, the cache is left empty until the next run, and the workflows that read it find no fields.
- **A failed account stops the whole run.** The `Get Custom Fields…` nodes have no error handling, so one bad token fails the execution before the table is touched.
- **`Merge3` is only there for ordering.** It waits for the delete branch and then passes on its second input, the new rows.
- **`Borrar filas existentes` has no column name in its filter.** The condition only carries the value `$json.id` and relies on the node's default key.
- **`Switch` matches `sede` names exactly,** accents included (`México`, `Perú`, `España`). Other workflows in this area spell some of them without accents.

## Who uses it

No person calls it in normal operation; it runs on its schedule. Its output, the `CustomFieldsHighLevel` table, is read by `Actualizar campo Comunidad WhatsApp auto COL` and `Upsert Contacts from Iniciados to Sedes`.
