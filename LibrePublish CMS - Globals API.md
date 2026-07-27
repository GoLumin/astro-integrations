---
tags: [cms, librepublish, api, reference]
---

# LibrePublish CMS — Globals (Singletons) API

LibrePublish is a hosted headless CMS. "Singletons" are called **globals** in its own terminology. There is no OpenAPI/docs endpoint — everything below was reverse-engineered by reading a consuming repo's `src/lib/cms.ts` and probing the live API.

## Setup

- Base URL: per-project `CMS_URL` env var (e.g. `https://mibox-rhode-island.librepublish.com`, or `https://miboxvt.librepublish.com` for a sibling site — one LibrePublish instance per site).
- Auth: `Authorization: Bearer <token>` header.
  - `CMS_TOKEN` — read-only token, for GETs.
  - `CMS_TOKEN_WRITE` — write token, for POST/PATCH/DELETE.
  - Both live in that project's `.env`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/globals` | List all. Envelope: `{"globals": [...]}` |
| GET | `/api/globals/:slug` | Fetch one. Envelope: `{"global": {...}}` |
| POST | `/api/globals` | Create. Body: `{"global": {"slug", "name", "description", "icon", "data": {...}}}`. Returns 201. 422 with `{"error":"invalid","errors":{"slug":["has already been taken"]}}` if the slug exists — **always GET the list first** to avoid racing/duplicating. |
| PATCH | `/api/globals/:slug` | Update `data`/`name`/`description`/`icon`. Same envelope shape as POST. Returns 200. |
| DELETE | `/api/globals/:slug` | Returns 204 No Content. |

### Example: create

```bash
curl -X POST -H "Authorization: Bearer $CMS_TOKEN_WRITE" -H "Content-Type: application/json" \
  -d '{
    "global": {
      "slug": "email_settings",
      "name": "Email Settings",
      "description": "Recipients and branding for outbound transactional emails.",
      "icon": "Mail",
      "data": {
        "admin_emails": [{"email": "someone@example.com"}],
        "cc_emails": [],
        "bcc_emails": [],
        "logo_url": "https://example.com/logo.svg"
      }
    }
  }' \
  "$CMS_URL/api/globals"
```

## Important limitation: field schema is dashboard-only

Every global response includes `fields: []` and a `json_schema: {...}` block — even for globals with a clearly real editor form in the dashboard (e.g. a `general` settings global). **This field-type configuration (marking a field as a "repeater", "url", "select", etc. so the dashboard renders the right input widget) cannot be set through this API.** Confirmed by PATCHing a `fields` array into a global and getting back `fields: []` unchanged.

The API only ever manipulates:
- the `data` blob (freeform JSON, whatever shape you send)
- `slug` / `name` / `description` / `icon`

To get a proper repeater/field-type editor UI, a human has to configure it by hand in the LibrePublish admin dashboard. The API-created `data` will populate correctly once that's done, as long as the field names match.

## Repeater field shape (reference)

Learned from `GET /api/block_types`, which — unlike globals — *does* return real field schemas for content blocks:

```json
{
  "name": "field_name",
  "label": "Human label",
  "type": "repeater",
  "required": true,
  "of": [
    {"name": "sub_field", "label": "Sub Field", "type": "string", "required": true}
  ]
}
```

Valid primitive field `type`s observed across block types: `asset`, `blocks`, `integer`, `link`, `markdown`, `record_refs`, `repeater`, `select`, `string`, `text`, `url`. No dedicated `email` type exists — use `string`.

Repeater row data in `data` is stored as an **array of objects** keyed by the `of` sub-field names — e.g. `[{"email": "a@b.com"}]` — never bare strings, even for a single-field repeater.

## Gotchas

- **Race conditions**: two sessions/processes hitting the same CMS can create duplicate/conflicting globals within seconds of each other. Always `GET /api/globals` and check the slug list before POSTing.
- Leftover test/probe globals are easy to create by accident while exploring this API — clean them up with `DELETE /api/globals/:slug`, or note them for the user to remove via the dashboard if they weren't yours to delete.
