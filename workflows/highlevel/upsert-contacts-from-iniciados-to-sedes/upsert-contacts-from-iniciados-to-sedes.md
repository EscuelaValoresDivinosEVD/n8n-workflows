# Upsert Contacts from Iniciados to Sedes

Copies the "iniciados" from the cache table into HighLevel: every cached person is upserted into the Global account and, through a sub-workflow, into the account of their sede. It runs on a schedule.

- **n8n workflow:** `Upsert Contacts from Iniciados to Sedes` (ID `lZdUuiJlyedZ18Uu`), project Personal, folder Producción
- **Status at import:** Published
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

> **Draft note.** At import the editor showed unpublished changes (draft last saved 2026-04-10, published version from 2026-03-31). The JSON in this folder and this document are the published (live) version. The unpublished draft is a rework of the custom-field handling:
>
> - It replaces `Switch` and `Edit Fields1`, `Edit Fields3`, `Edit Fields4` with `Switch Custom Fields`, `Estado del Iniciado IDs`, `Grupo SKY IDs`, `Círculo IDs`, a new `Sede IDs` branch and `Merge4`, so the sede custom field is handled too.
> - `Call 'Upsert contact by email multi credential'` maps all 16 sub-workflow inputs explicitly; in the published version the mapping is empty.
> - `Upsert contacts Global` also sends each custom field's `key`.
> - `Edit Fields2` no longer sets the four `…CustomFielIdSede` fields.

## Trigger

- `Schedule Trigger`: the rule is left at its defaults (`interval: [{}]`), which in n8n means once a day at midnight, in the instance's timezone.
- `When clicking ‘Execute workflow’`: manual run from the editor.

There is no webhook.

## What it does

1. **Read three tables,** in parallel:
   - `Get Iniciados SKY` reads `Cache contactos Iniciados SKY`: one row per person with name, email, phone, sede, estado, círculo and grupo SKY.
   - `Get Location IDs sedes` reads the location-id table: `sede` → `locationId`.
   - `Get Custon Field Sedes` reads `CustomFieldsHighLevel`: the custom fields of every account.
2. **Attach the sede's location.** `Edit Fields2` and `Edit Fields` shape the two inputs, and `Merge` adds `locationIdSede` to each person by matching on `sede`.
3. **Attach the sede's custom-field ids.** `Switch` splits the custom-field rows into "Estado del Iniciado", "Grupo SKY" and "Círculo"; `Edit Fields1`, `Edit Fields3` and `Edit Fields4` rename their id, key and name; and `Merge1`, `Merge2`, `Merge3` add each set to the person, again matching on `sede`.
4. **Upsert into the sede account.** `Call 'Upsert contact by email multi credential'` runs the sub-workflow `Sub. Upsert contact by email multi credential Iniciados Sedes` and waits for it.
5. **Upsert into the Global account.** In parallel, `Upsert contacts Global` calls `POST https://services.leadconnectorhq.com/contacts/upsert` with the person's name, email, estado, círculo and grupo SKY.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Bearer Auth Global Highlevel` | `httpBearerAuth` | `O5VIrmRZ8U44X95T` | `Upsert contacts Global` |

It reads three n8n data tables: `Cache contactos Iniciados SKY` (ID `IsF4IohkX1358wkI`), the location-id table (ID `p5K85zArH4y1XQ61`) and `CustomFieldsHighLevel` (ID `dnPzVbYwHPI3hP3B`).

The sede accounts are written through the sub-workflow, which holds their 13 credentials.

Failed executions are reported by `Notificación de errores` (ID `RFQhLaxt4mH5fioB`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **The published call to the sub-workflow maps no inputs.** `Call 'Upsert contact by email multi credential'` has an empty mapping, while the sub-workflow expects 16 named inputs. Whether the sede upserts receive any data in the published version has not been checked against an execution; the draft fills the mapping in, which suggests they did not.
- **`Upsert contacts Global` hard-codes the Global account.** The location id and the three custom-field ids are written into the request body instead of coming from the tables.
- **Everyone is upserted on every run.** There is no "changed since" filter, so each run sends one Global request per cached person plus one sub-workflow call.
- **`Switch` rule for Círculo is `'Círculo' || 'Circulo'`,** which always evaluates to `'Círculo'`. A field named `Circulo` without the accent does not match.
- **The merges enrich by `sede` and keep all matches.** A sede with two custom fields of the same name would duplicate every person in that sede.
- **Field names are inconsistent.** `Edit Fields2` writes `…CustomFielIdSede` (missing `d`), the later nodes write `…CustomFieldIdSede`, and the sub-workflow expects `grupoSkyCustomFielKeySede`.
- **The `sede` values must match across three tables and the sub-workflow's `Switch`,** accents included.

## Who uses it

No person calls it in normal operation; it runs on its schedule. It depends on `Actualizar tabla cache iniciados - iniciado actualizado desde PI` and `Actualizar tabla cache custom fields highlevel` keeping its input tables current.
