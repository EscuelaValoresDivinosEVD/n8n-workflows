# Search contact email multi credential

Looks up a contact by email in one sede's HighLevel account. It is a sub-workflow: other workflows call it, it has no webhook or schedule. Only the Colombia branch is built.

- **n8n workflow:** `Search contact email multi credential` (ID `6qhZUSezq5maFpIE`), project Personal
- **Status at import:** Published, editor matches the published version
- **Imported:** 2026-10-03, published version read from n8n's API (no `pinData`)

## Trigger

`When Executed by Another Workflow` (Execute Workflow Trigger) with three inputs: `sede`, `locationIdSede` and `email`. None of the other imported workflows calls it.

## What it does

1. **Route by sede.** `Switch` has one output per sede (Argentina, Chile, Colombia, Costa Rica, Cuenca, España, Italia, Mexico, Online, Peru, Quito, Uruguay and Venezuela).
2. **Search.** Only the Colombia output is connected: `Search for a contact email` calls `POST https://services.leadconnectorhq.com/contacts/search` for contacts in `locationIdSede` whose email equals `email`, and returns up to 10.

## Credentials

| Credential | Type | ID | Used by |
|---|---|---|---|
| `Bearer Auth Colombia Highlevel` | `httpBearerAuth` | `PyXklTRTJY2dAosR` | `Search for a contact email` |

No error workflow is set for this workflow.

## Tricky nodes

- **Twelve of the thirteen `Switch` outputs lead nowhere.** A call for any sede other than Colombia returns nothing, with no error.
- **`Switch` spells `Mexico` and `Peru` without accents,** unlike the upsert sub-workflow and the custom-fields cache, which use `México` and `Perú`.
- **`Search for a contact email` continues on error** (`onError: continueRegularOutput`), so a failed HighLevel call looks like an empty result.

## Who uses it

Nothing among the imported workflows. It looks like an early version of the multi-credential pattern. To be confirmed: whether it can be unpublished.
