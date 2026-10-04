# Actualizar tabla cache iniciados - iniciado actualizado desde PI

Refreshes one person's row in the n8n data table `Cache contactos Iniciados SKY` when their contact changes in the Iniciados HighLevel account. HighLevel calls the webhook, the workflow reads the contact back from HighLevel and overwrites the cached row.

- **n8n workflow:** `Actualizar tabla cache iniciados - iniciado actualizado desde PI` (ID `vQAkuvAc7kOcG21q7kJjD`), project Personal, folder Producción
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

`POST /webhook/highlevel/update/contact/iniciados` on the n8n instance (`Webhook` node, path `highlevel/update/contact/iniciados`).

Authentication is header auth, using the credential `Header Auth n8n.highlevel`.

The response is the output of whichever node runs last (`responseMode: lastNode`).

### Request body

The body schema is not declared in the workflow; this is inferred from the expressions that read `body.*`. The caller is a HighLevel workflow, which sends the whole contact record; only these fields are read.

| Field | Required | Used for |
|---|---|---|
| `contact_id` | Yes | Id of the contact that changed, in the Iniciados HighLevel account. |
| `location.id` | Yes | HighLevel location id of the account the contact belongs to. |

## What it does

1. **Read the contact.** `Search for a contact id` calls `POST https://services.leadconnectorhq.com/contacts/search` for the contact with that id in that location.
2. **Update the cache.** `Update row(s)` finds the row of `Cache contactos Iniciados SKY` whose `contactIdIniciados` equals the contact's id and overwrites `firstName`, `lastName`, `phone`, `email`, `sede`, `estadoDelIniciado`, `circulo` and `grupoSky`.

### Responses

| Situation | What the caller gets |
|---|---|
| Row updated | The updated data table row. |
| HighLevel search fails | n8n's error response; the failure is also emailed by `Notificación de errores`. |

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Header Auth n8n.highlevel` | `httpHeaderAuth` | `psZv93SrO3IkUx5T` | `Webhook` |
| `Bearer Auth Iniciados Highlevel` | `httpBearerAuth` | `IQy6TekEHKezE5le` | `Search for a contact id` |

It writes the n8n data table `Cache contactos Iniciados SKY` (ID `IsF4IohkX1358wkI`).

Failed executions are reported by `Notificación de errores` (ID `RFQhLaxt4mH5fioB`), set as this workflow's error workflow in n8n.

## Tricky nodes

- **`Update row(s)` reads custom fields by position.** `estadoDelIniciado` is `customFields[0]`, `grupoSky` is `[1]`, `sede` is `[2]` and `circulo` is `[3]`. HighLevel does not promise that order; a contact with a missing or extra custom field would put values in the wrong columns.
- **It only updates, never inserts.** A contact that is not already in the cache table is not added; the update matches nothing and nothing is reported.
- **The webhook body is trusted for the location.** The search uses `location.id` from the request with the Iniciados credential, so a call for a contact in another account returns nothing.
- **"PI" in the name** is not explained anywhere in the workflow.

## Who uses it

A HighLevel workflow in the Iniciados account calls it when a contact is updated. The cache it maintains is read by `Upsert Contacts from Iniciados to Sedes`. To be filled in: which HighLevel workflow.
