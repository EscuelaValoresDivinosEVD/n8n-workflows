# Actualizar campo Comunidad WhatsApp auto COL

Keeps a HighLevel contact field in step with membership of the Colombia WhatsApp announcements group. When someone joins or leaves the group, it finds the matching contact in the Colombia HighLevel account by phone number and sets the "Grupo de avisos WhatsApp" custom field to `Ingresado` or `Retirado`.

- **n8n workflow:** `Actualizar campo Comunidad WhatsApp auto COL` (ID `kXtjnfDckH5o7dev`), project Personal, folder Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

`POST /webhook/waha/participants` on the n8n instance (`Webhook` node, path `waha/participants`).

Authentication is header auth, using the credential `Header Auth n8n.highlevel`.

The response is the output of whichever node runs last (`responseMode: lastNode`, all entries).

### Request body

The body schema is not declared in the workflow; this is inferred from the expressions that read `body.*`. The caller is WAHA (the WhatsApp HTTP API), which sends its group-participants event; only these fields are read.

| Field | Required | Used for |
|---|---|---|
| `session` | Yes | WAHA session name, used for the two lookups back into WAHA. |
| `payload.type` | Yes | Event type. Only values containing `join` or `leave` are processed. |
| `payload.participants` | Yes | Participants affected by the event. Only the first entry's `id` is used. |
| `payload.group.id` | Yes | WhatsApp id of the group the event happened in. |

## What it does

1. **Filter the event.** `If` continues only when `payload.type` contains `join` or `leave`.
2. **Look up the person.** `Get contact basic info` asks WAHA for the first participant's contact, and `Edit Fields1` keeps the phone number as `+{number}` together with the event type.
3. **Check the group.** `Get the group.` asks WAHA for the group, and `If1` continues only if the group's subject contains "Colombia". Otherwise `Stop and Error1` fails the execution with "Grupo no es Anuncios Colombia".
4. **Find the custom field.** `Get row(s)` reads the `CustomFieldsHighLevel` data table for the field named "Grupo de avisos WhatsApp" in the sede named by the last word of the group's subject.
5. **Find the contact.** `Merge` joins the person and the field, and `Search contact in Highlevel` searches the Colombia account for a contact whose phone contains the number. If none is found, `Stop and Error` fails the execution with "No found".
6. **Update the field.** `Switch` routes `join` to `Edit Fields` (`Ingresado`) and `leave` to `Edit Fields2` (`Retirado`), and `Update Grupo Avisos` sends `PUT https://services.leadconnectorhq.com/contacts/{contactId}` with the new value.

### Responses

| Situation | What the caller gets |
|---|---|
| Field updated | The HighLevel response to the contact update. |
| Event is not a join or leave | n8n's default response; the workflow ends at `If`. |
| Group is not a Colombia group, or no contact has that phone | n8n's error response, because a `Stop and Error` node fails the execution. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth n8n.highlevel` | `httpHeaderAuth` | `psZv93SrO3IkUx5T` | `Webhook` |
| `WAHA account n8n.evdsky` | `wahaApi` | `Y4Ff0AdNYa0j7Oga` | `Get contact basic info`, `Get the group.` |
| `Bearer Auth Colombia Highlevel` | `httpBearerAuth` | `PyXklTRTJY2dAosR` | `Search contact in Highlevel`, `Update Grupo Avisos` |

It reads the n8n data table `CustomFieldsHighLevel` (ID `dnPzVbYwHPI3hP3B`), which is filled by `Actualizar tabla cache custom fields highlevel`.

It needs the community node `@devlikeapro/n8n-nodes-waha` installed on the instance.

Failed executions are reported by `Notificación de errores` (ID `RFQhLaxt4mH5fioB`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **Normal events end as errors.** Someone joining a non-Colombia group, or a participant who is not a HighLevel contact, fails the execution through `Stop and Error`. Each of those triggers an error email.
- **`Get row(s)` derives the sede from the group's name.** It takes the last word of the WhatsApp group subject and matches it against the `sede` column. Renaming the group changes which row, if any, is found.
- **`If1` only checks for the word "Colombia",** and both HighLevel nodes use the Colombia credential. The workflow is Colombia-only even though step 4 looks the sede up generically.
- **`Search contact in Highlevel` matches by "phone contains".** A short or partial number could match the wrong contact; only the first result is used.
- **Only the first participant is handled.** An event that adds or removes several people updates one contact.
- **`Merge` pairs by position** the person (input 1) with the custom-field row (input 2), so it relies on each branch producing exactly one item.
- **Error outputs are not connected.** `Search contact in Highlevel` and `Update Grupo Avisos` use `onError: continueErrorOutput`, so a failed HighLevel call ends that branch without an error email.

## Who uses it

WAHA calls it automatically on WhatsApp group membership events. The result is used by whoever works with the Colombia HighLevel account. To be filled in.
