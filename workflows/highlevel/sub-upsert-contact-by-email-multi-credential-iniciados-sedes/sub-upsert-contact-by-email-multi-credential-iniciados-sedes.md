# Sub. Upsert contact by email multi credential Iniciados Sedes

Creates or updates one contact in a sede's HighLevel account, matched by email, and sets its "iniciado" custom fields. It is a sub-workflow: other workflows call it, it has no webhook or schedule.

- **n8n workflow:** `Sub. Upsert contact by email multi credential Iniciados Sedes` (ID `l0qufeMRpgfP3XCb`), project Personal, folder Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

`When Executed by Another Workflow` (Execute Workflow Trigger). At import the only caller is `Upsert Contacts from Iniciados to Sedes`.

It declares 16 inputs: `sede`, `locationIdSede`, `email`, `firstName`, `lastName`, `estadoDelIniciado`, `estadoDelIniciadoCustomFieldIdSede`, `estadoDelIniciadoCustomFieldKeySede`, `circulo`, `circuloCustomFieldIdSede`, `circuloCustomFieldKeySede`, `grupoSky`, `grupoSkyCustomFieldIdSede`, `grupoSkyCustomFielKeySede`, `sedeCustomFieldIdSede` and `sedeCustomFieldKeySede`.

## What it does

1. **Route by sede.** `Switch` sends the item to one of 13 outputs: Argentina, Chile, Colombia, Costa Rica, Cuenca, España, Italia, México, Online, Perú, Quito, Uruguay and Venezuela.
2. **Upsert.** Each output has its own `Upsert contacts <sede>` node with that sede's credential. It calls `POST https://services.leadconnectorhq.com/contacts/upsert` with `firstName`, `lastName`, `email`, the sede's `locationId` and four custom fields: estado del iniciado, círculo, grupo SKY and sede.
3. **Return.** `Merge` and `Merge1` append the results of all branches.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Bearer Auth Argentina Highlevel` | `httpBearerAuth` | `buxNC8ku50XFzgM7` | `Upsert contacts Argentina` |
| `Bearer Auth Chile Highlevel` | `httpBearerAuth` | `sMIB4Sb2W4MzBC2J` | `Upsert contacts Chile` |
| `Bearer Auth Colombia Highlevel` | `httpBearerAuth` | `PyXklTRTJY2dAosR` | `Upsert contacts Colombia` |
| `Bearer Auth Costa Rica Highlevel` | `httpBearerAuth` | `F5AOajTCo9EG5COw` | `Upsert contacts Costa Rica` |
| `Bearer Auth Cuenca Highlevel` | `httpBearerAuth` | `P47VMvRcYpWJSNXH` | `Upsert contacts Cuenca` |
| `Bearer Auth España Highlevel` | `httpBearerAuth` | `a0DW5j5LJGDPDXXn` | `Upsert contacts España` |
| `Bearer Auth Italia Highlevel` | `httpBearerAuth` | `MO0Qxn2BYYhStBMD` | `Upsert contacts Italia` |
| `Bearer Auth México Highlevel` | `httpBearerAuth` | `ltwVsPHswYrZeOFR` | `Upsert contacts México` |
| `Bearer Auth Online Highlevel` | `httpBearerAuth` | `ww8M8639TJUuQ7lW` | `Upsert contacts Online` |
| `Bearer Auth Perú Highlevel` | `httpBearerAuth` | `oYaQzJfTFJ22vAib` | `Upsert contacts Perú` |
| `Bearer Auth Quito Highlevel` | `httpBearerAuth` | `fgQLqrKHTsgXIR5l` | `Upsert contacts Quito` |
| `Bearer Auth Uruguay Highlevel` | `httpBearerAuth` | `h1YF0ou8b82NIm5L` | `Upsert contacts Uruguay` |
| `Bearer Auth Venezuela Highlevel` | `httpBearerAuth` | `KdOIB7khZGmkiiio` | `Upsert contacts Venezuela` |

Failed executions are reported by `Notificación de errores` (ID `RFQhLaxt4mH5fioB`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **One node per sede exists because each HighLevel account has its own token.** n8n cannot pick a credential from data, so `Switch` routes to the node that has the right credential attached. All 13 upsert nodes are otherwise the same; a change to the request body has to be made 13 times.
- **Two custom fields send the id as the key.** In the request body, the grupo SKY and sede fields use `…CustomFieldIdSede` for both `id` and `key`, while estado and círculo use the separate `…KeySede` input. The inputs `grupoSkyCustomFielKeySede` and `sedeCustomFieldKeySede` are declared but never used.
- **Every upsert continues on error** (`onError: continueRegularOutput`). A rejected upsert returns its error as ordinary data, the run finishes successfully and no error email is sent.
- **Input names are inconsistent:** `grupoSkyCustomFielKeySede` is missing a `d`. The caller has to use the same spelling.
- **`Switch` matches `sede` exactly,** accents included. A sede value with no matching rule is dropped silently.
- **`Merge` is split in two** (10 inputs and 4 inputs) only because of how many inputs one node can take.

## Who uses it

`Upsert Contacts from Iniciados to Sedes`.
