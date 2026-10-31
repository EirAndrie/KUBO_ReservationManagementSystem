# Guest Management Hardening

**Date:** 2026-10-31

## Summary

The guest module now uses the live `kubo_guest_management` routines and follows
the guest business rules agreed for implementation.

Implemented behavior:

- Guest creation reuses an existing record by email or ID details.
- Names, contact details, address, and ID details can all be updated.
- Phone numbers accept both `09XXXXXXXXX` and `+639XXXXXXXXX`.
- ID types use the exact database enum labels.
- Guest list/search is paginated in the database.
- Unused guests can be deleted; guests with reservations cannot.
- A guest can still be looked up by email or ID type/number.
- Deleting guests is intended for Administrators; enforcement waits on auth.

## Migration

Added:

- `backend/src/migrations/20261031_harden_guest_management.sql`

### Database changes

Added unique indexes:

- `guest_email_lower_unique` on `lower(email)`
- `guest_valid_id_unique` on `(valid_id_type, lower(id_number))`

Added functions:

| Function | Purpose |
|---|---|
| `kubo_guest_management.fn_get_guest_by_id` | Safe single-guest lookup. |
| `kubo_guest_management.fn_get_guest_by_email` | Case-insensitive lookup for reuse and duplicate prevention. |
| `kubo_guest_management.fn_get_guest_by_id_number` | Lookup by ID type + ID number. |
| `kubo_guest_management.fn_search_guests` | Paginated list/search with name, email, phone, generic search, and ID-type filters. |
| `kubo_guest_management.fn_create_guest` | Creates a guest or returns the existing matching guest. |
| `kubo_guest_management.fn_update_guest` | Updates names, contact details, address, and ID details. |
| `kubo_guest_management.fn_delete_unused_guest` | Deletes a guest only when no reservation references it. |

The old `sp_create_guest`, `sp_update_guest_contact`, and
`sp_delete_unused_guest` procedures remain in the database for compatibility but
are no longer used by the module.

### Create/reuse behavior

Creation checks, in order:

1. Existing guest with the same email (case-insensitive).
2. Existing guest with the same ID type and ID number (case-insensitive ID).
3. Otherwise, insert a new guest.

If a match exists, the existing guest row is returned. This supports the case
where a returning guest has changed their name, email, phone, or ID details.

Concurrent inserts are protected by:

- `guest_email_lower_unique`
- `guest_valid_id_unique`

The create function catches a unique violation and returns the matching existing
guest when possible.

### Update behavior

`fn_update_guest` supports:

- `first_name`
- `last_name`
- `email`
- `phone`
- `valid_id_type`
- `id_number`
- `address_line_1`
- `city`
- `state_province`
- `zip_postal_code`
- `country`

Validation includes:

- Required/blank checks for supplied profile fields.
- Email format and case-insensitive uniqueness.
- Phone format (`09XXXXXXXXX` or `+639XXXXXXXXX`).
- ID type/number uniqueness, excluding the current guest.
- Row locking for concurrent updates.
- `updated_at` refresh.

### Delete behavior

`fn_delete_unused_guest`:

- Locks the guest row.
- Returns `false` when the guest does not exist.
- Raises `23503` when a reservation references the guest.
- Deletes only unreferenced guests.

Administrator-only authorization is documented in the route but cannot be
enforced until authentication/RBAC exists.

## Module changes

### Schema

`guest.schema.ts` now:

- Uses exact database ID enum labels (`Passport`, `DriverLicense`, etc.).
- Requires email.
- Accepts both agreed Philippine phone formats.
- Treats address fields as optional.
- Fixes `zidPostalCode` to `zipPostalCode`.
- Removes `guestId` from the update payload; the route parameter is authoritative.
- Adds `GuestFilterSchema` for `search` and `validIdType`.

### Repository

`guest.repository.ts` now calls:

- `fn_create_guest`
- `fn_search_guests`
- `fn_get_guest_by_id`
- `fn_get_guest_by_email`
- `fn_get_guest_by_id_number`
- `fn_update_guest`
- `fn_delete_unused_guest`

All database errors are mapped through `mapDatabaseError`.

### Service

`guest.services.ts` now:

- Reuses an existing guest by email or ID details before creating.
- Applies pagination to unfiltered listing.
- Passes the route guest ID into updates.
- Confirms deletion actually occurred.

### Controller

`guest.controllers.ts` now:

- Returns `201` for a new guest and `200` for a reused guest.
- Includes a `reused` boolean in the create response.
- Validates `search` and `validIdType` query filters.
- Applies pagination even when no filters are supplied.
- Uses the route parameter as the update target.

## API behavior

### Create or reuse

```http
POST /KUBO_Resort/Management-System/v0.0.1/guests
Content-Type: application/json
```

```json
{
      "firstName": "Temp",
      "lastName": "Guest",
      "email": "temp.guest@example.com",
      "phone": "09171234567",
      "validIdType": "NationalID",
      "idNumber": "TEMP-ID-0001",
      "addressLine1": "1 Test St",
      "city": "Manila",
      "stateProvince": "Metro Manila",
      "zipPostalCode": "1000",
      "country": "Philippines"
}
```

New guest:

- Status: `201`
- `reused: false`

Existing guest:

- Status: `200`
- `reused: true`

### List/search

```http
GET /KUBO_Resort/Management-System/v0.0.1/guests?page=1&limit=10&search=andrie&validIdType=NationalID
```

Filters are optional. Pagination defaults to page 1 and limit 10.

### Update

```http
PATCH /KUBO_Resort/Management-System/v0.0.1/guests/:guestId
```

Any of the profile, contact, address, or ID fields can be supplied.

### Delete

```http
DELETE /KUBO_Resort/Management-System/v0.0.1/guests/:guestId
```

Returns `204` when deleted. Referenced guests return `409`.

## Verification performed

- `npm run typecheck` passed.
- `npm run build` passed.
- Migration applied successfully.
- Database tests:
  - Create returns a safe guest row.
  - Creating with the same email reuses the existing guest.
  - Creating with the same ID type/number reuses the existing guest.
  - Search by text and ID type works.
  - Update changes names, email, phone, and ID details.
  - Duplicate email update fails with a clear business error.
  - Invalid phone update fails with a clear business error.
  - Unused guest deletion returns `true`.
  - Referenced guest deletion raises `23503`.
- API tests:
  - `GET /guests` returns paginated guests.
  - `GET /guests?search=...` works.
  - `GET /guests?validIdType=NationalID` works.
  - Invalid ID type returns `400`.
  - `POST /guests` returns `201` for a new guest.
  - Repeating the email returns `200` with `reused: true`.
  - `PATCH /guests/:id` updates name and ID details.
  - `DELETE /guests/:id` returns `204`.
  - Fetching the deleted guest returns `404`.

## Remaining limitations

1. **Administrator-only deletion is not enforced yet.**
   - No authentication/RBAC middleware exists.
   - The route is documented as Administrator-only and must be restricted once
     authentication provides the acting employee.

2. **Guest audit writes are deferred.**
   - Guest create/update/delete do not yet write audit rows.
   - This follows the same auth-actor blocker as role/employee auditing.

3. **Legacy guest procedures remain in the database.**
   - `sp_create_guest`, `sp_update_guest_contact`, and
     `sp_delete_unused_guest` are unused.
   - They can be removed once no external tooling depends on them.

4. **Validation middleware still returns Express HTML errors.**
   - `validateBody` passes `AppError` to `next`, but no global Express error
     handler exists.
   - This is pre-existing across modules.
