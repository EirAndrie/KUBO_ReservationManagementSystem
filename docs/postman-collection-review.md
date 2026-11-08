# Postman Collection Review

Reviewed 2026-11-06 against the mounted Express routes, request schemas, controllers, and the stored-function contracts used by the repositories.

## Scope and result

The collection contains 87 request files: 67 regular requests and 20 requests in `Write Tests (test DB only)`. The configured API prefix is correct. The initial review was static; observed local-run results are recorded in the runtime section below.

## Findings

| Priority | Finding | Likely effect | Recommended correction |
|---|---|---|---|
| High | The `local` environment originally left `base_url`, both usernames, and both passwords blank. The collection login script uses `base_url` to request `/auth/login`. | Automatic sign-in has no credentials until the local environment is filled. | The local environment now has the correct `base_url`; fill in the active Staff and Administrator usernames and passwords in Postman. Keep passwords in secret fields. |
| High | The original role-selection rule covered only `/roles`, `/employees`, and `/audit-logs`. | Administrator-only catalog writes, request approvals/rejections, charge corrections, kubo-type writes, and kubo writes could inherit the Staff token and return `403`. | Updated the repository's v3 collection script to select the Administrator token for those routes. The separate downloaded JSON collection has no such login helper; use the repository v3 collection in Local Mode. |
| Medium | All 67 regular request URLs contain a fixed `http://localhost:8080/...` address. Only the 20 write-test requests use `{{base_url}}`. | Changing the environment's base URL changes the helper login target and write-test requests, but leaves the regular requests pointed at localhost. This can authenticate against one server and send requests to another. | Use `{{base_url}}` consistently for every request URL, with the full mounted API prefix in the variable. |
| Medium | Fourteen `GET` requests contain a request body, including reservation, employee, kubo, and catalog reads. | The backend read controllers do not use those bodies; the supplied filters or resource data are silently ignored. The employee read body also includes a field named `passwordHash`, which should not be sent on a read request. | Remove bodies from `GET` requests. Put supported filters in the query string. |
| Medium | Many write requests send `employeeId` in the JSON body or query string. | The authenticated actor is taken from the JWT (`req.auth.employeeId`). These client-supplied values are ignored or stripped during validation; they do not choose the audit actor. | Remove `employeeId` from request bodies and query strings. Use the correct Staff or Administrator Bearer token. |
| Medium | The global response script checks generic `success: true` for `GET` and login requests, but does not check endpoint-specific response keys or most mutation results. | A response can pass the collection's generic checks while returning the wrong resource envelope. Most writes have no general success/error contract assertion. | Add checks for the expected keys (`guests`, `reservations`, `payments`, `additionalChargeCatalog`, and so on), plus expected mutation status codes and `204 No Content` cases. |
| Low | There are no requests for `POST /auth/logout` or the Administrator audit-log endpoints. | Logout audit behavior and audit-log search/history are not covered by this collection. | Add requests for logout and `GET /audit-logs`, `GET /audit-logs/:auditId`, `GET /audit-logs/history/:entityType/:entityId`, and `GET /audit-logs/employees/:employeeId/audit-logs`. |

## Contract cross-check

- The regular collection paths use the live base prefix and mounted resource paths. The catalog status path (`PATCH /additional-charge-catalog/:catalogId/status`) is a supported alias of the general catalog update route.
- The collection's login payload (`username`, `password`) and core reservation, payment, refund, and catalog field names otherwise match the route schemas. The employee creation field is named `passwordHash` by the current API schema; the service treats its value as the initial plaintext password and hashes it before storage.
- `GET` responses use `{ success: true, message, ... }`. The resource property differs by module, and delete/logout endpoints may return `204` with no body. The collection currently does not verify most of those endpoint-specific shapes.
- The stored UUIDs in regular requests depend on the local database state. Missing or changed records can produce `404`, uniqueness conflicts, invalid state transitions, or other expected business-rule errors even after authentication is fixed.
- The write-test folder deliberately skips every request unless `allow_writes=true` is supplied. Run that sequence only against a disposable test database; it creates and deletes records, and its audit rows remain because audit history is append-only.

## Relevant live contracts

- [Auth API contract](../backend/src/modules/auth/API_CONTRACT.md)
- [Reservation API contract](../backend/src/modules/reservation/API_CONTRACT.md)
- [Payment API contract](../backend/src/modules/payment/API_CONTRACT.md)
- [Additional-charge API contract](../backend/src/modules/additional-charges/API_CONTRACT.md)

## Follow-up: supplied JSON collection

The later-supplied `KUBO_ManagementSystem.postman_collection.json` in Downloads is a separate Postman export from the 87 YAML request files reviewed above. It contains 67 requests, all with fixed localhost URLs. It has no collection-level authorization, environment variables, or token script; 24 requests carry static Authorization header values, while 41 protected requests have no Authorization header. Fourteen GET requests also contain bodies that the backend does not use.

The earlier local JSON copy and environment are Postman v2.1 JSON. The screenshots show that the current Postman Local Mode does not accept those files; ignore them there. Use the repository's native v3 collection at `postman/collections/KUBO_ManagementSystem` and its environment at `postman/environments/local.environment.yaml`. The local environment's `base_url` is now prefilled. Sample record IDs remain state-dependent. No requests were sent to a production API; the isolated local test run is described below.

## Runtime test run — 2026-11-07

The native v3 collection's `Write Tests (test DB only)` folder was run with the Postman CLI against a separate `KUBO_Postman_Test` database and the API at `http://localhost:8081/KUBO_Resort/Management-System/v0.0.1`. Cloud result reporting was disabled. No requests were sent to the regular development API on port `8080`.

| Result | Count |
|---|---:|
| Requests executed | 20 |
| Request-level errors | 0 |
| Assertions passed | 28 of 31 |
| Assertions failed | 3 |

The guest and reservation workflows, role restrictions, overlapping-booking guard, overpayment guard, payment completion, balance calculation, and refund guards passed. The three failed assertions are all in the final cleanup sequence:

| Request | Expected | Observed | Cause |
|---|---|---|---|
| `18 Cleanup - delete reservation` | `204 No Content` | `500 Internal Server Error` | The stored delete routine deletes the reservation before its `reserved_kubo` child rows. PostgreSQL rejects that order because `reserved_kubo_reservation_id_fkey` is `RESTRICT`. |
| `19 Cleanup - delete guest` | `204 No Content` | `409 Conflict` | Follow-on failure: the reservation from request 18 still references the guest. |
| `20 Reservation is gone` | `404 Not Found` | `200 OK` | Follow-on failure: the reservation was not deleted. |

The cleanup failure is a backend defect in `kubo_reservation_management.fn_delete_reservation`, not a failed reservation-creation or payment guard. The function should remove the reservation's assignment rows inside its transaction before deleting the reservation, then release the affected kubos. The API delete contract currently documents a successful delete, but the actual child-row foreign key prevents it.

The runner also printed two `POST /auth/login` prerequest calls as errored with `Could not read response data`. The main collection run continued, and all protected-request authorization assertions passed. This login-helper output is separate from the three failed assertions and should be investigated before relying on those helper calls to refresh tokens in a clean Postman session.

The collection deleted the temporary refund and payment records. After the run, the remaining temporary reservation, its assignment, and its guest were removed from `KUBO_Postman_Test` only, after confirming that the reservation had no remaining payment, applied-charge, or charge-request history. Append-only audit entries remain by design.
