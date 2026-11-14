# Administrator and Staff Test Checklist

Use a disposable database with one active Staff account and the active Administrator account. Create fresh guests, kubos, catalog items, reservations, and payments for each run. Record the generated IDs and reference codes as you go. Audit rows are append-only, so cleanup will not erase the test history.

## Staff workflow

### 1. Register or reuse a guest

- [ ] Search by email before creating a guest.
- [ ] Create a guest with a unique email, valid Philippine phone number, supported ID type, and ID number. Confirm the new profile is returned and the ID number is masked in logs and audit details.
- [ ] Submit the same email or valid ID type/number pair again. Confirm the existing guest is reused (`reused: true`) instead of creating a duplicate.
- [ ] Try an invalid phone number and a missing ID number. Confirm validation errors are returned and no guest is created. A matching email or ID pair is an intentional reuse case, not a duplicate-record error.

### 2. Create, confirm, and update a reservation

- [ ] Create a reservation with the guest, a supported booking source, and at least one kubo assignment with future dates.
- [ ] Confirm the server generates the reference code, sets the initial status to `Pending`, and snapshots the current nightly rate for each assignment.
- [ ] Try creating a reservation with no assignments, a checkout date on or before check-in, a past check-in date, and an overlapping stay for the same kubo. Confirm each invalid request is rejected without a partial reservation or assignment.
- [ ] Confirm the reservation. Try to confirm it again or confirm a cancelled reservation; both should be rejected.
- [ ] Update an eligible `Pending` or `Confirmed` reservation. Confirm new or re-dated assignments use the current rate while unchanged assignments keep their booked rate.
- [ ] Try to modify a reservation after check-in. Confirm the change is rejected.

### 3. Check in

- [ ] Confirm the reservation is `Confirmed`, the assignment is scheduled for the current date, and the kubo is `Available` or `Reserved`.
- [ ] Check in the assigned kubo. Confirm the assignment becomes `CheckedIn`, the kubo becomes `Occupied`, the reservation becomes `CheckedIn`, and the action is audited.
- [ ] Try check-in for a `Pending`, cancelled, no-show, or already checked-in reservation. Confirm it is rejected.
- [ ] Try checking in a kubo in `Cleaning`, `Maintenance`, `UnderInspection`, `OutOfService`, or `Occupied`. Confirm it is rejected until the kubo is assignable.
- [ ] For an early arrival, approve early check-in first and confirm that the approval is audited. Without approval, early check-in should be rejected.

### 4. Add catalog charges and submit custom requests

- [ ] Apply an active catalog item with quantity 1, then apply one with a quantity greater than 1. Confirm the charge amount is quantity multiplied by the catalog unit price and is added to the derived balance.
- [ ] Change the catalog price after a charge has been applied. Confirm the existing charge retains its recorded unit amount and amount.
- [ ] Try applying an inactive catalog item or adding a charge to a `Cancelled` or `NoShow` reservation. Confirm the operation is rejected.
- [ ] Submit a custom charge request for a service not in the catalog. Confirm it starts as `Pending` and does not change the reservation balance.
- [ ] Withdraw a pending request as the requesting Staff member. Confirm it becomes `Withdrawn` and creates no applied charge. Try withdrawing it as another Staff member and confirm that request is rejected.
- [ ] Ask an Administrator to approve one request at the proposed amount and one with an adjusted amount. Confirm an adjusted amount requires a reason and approval creates one applied charge using the requested quantity.
- [ ] Ask an Administrator to reject a request with a reason. Confirm no applied charge or balance change is created.

### 5. Record payments and refunds

- [ ] Record a payment on an eligible reservation. Confirm the server sets its status to `Pending` and supplies the timestamp; neither value is controlled by the client.
- [ ] Move the payment through valid transitions (`Pending` to `Processing` and then `Completed`, or directly to a terminal result allowed by the API). Confirm only completed payments reduce the outstanding balance.
- [ ] Submit a payment larger than the outstanding balance with no approval. Confirm it is rejected and the dialog asks for an Administrator overpayment approval.
- [ ] Ask an Administrator to approve an overpayment (maximum excess and reason) on the reservation page. Record a payment up to that excess and choose the approval. Confirm the payment is accepted, the approval shows **Used**, the balance becomes a guest credit, and the reservation page asks for the credit to be refunded before check-out.
- [ ] Try an excess larger than the approval and try reusing a used approval. Confirm both are rejected.
- [ ] Cancel a pending payment that used an approval. Confirm the approval becomes **Available** again.
- [ ] Refund part of a completed payment on the same reservation. Confirm the refund is a positive amount, its `related_payment_id` is the original payment, the original payment becomes `PartiallyRefunded`, and the balance increases by the refunded amount.
- [ ] Refund the remaining amount. Confirm the original payment becomes `Refunded`.
- [ ] Try refunding more than the net paid amount, more than the original payment's unrefunded amount, refunding a non-completed payment, or referencing a completed payment from another reservation. Confirm each request is rejected.

### 6. Check out at zero balance

- [ ] Leave an outstanding balance and try checking out an assignment. Confirm checkout is rejected.
- [ ] Complete payments until the derived outstanding balance is exactly ₱0.00, then check out each checked-in kubo.
- [ ] For a reservation with multiple kubos, check out one assignment while another remains active. Confirm the reservation does not become `CheckedOut` until every assignment is terminal and at least one assignment was checked out.
- [ ] Confirm each completed checkout records its timestamp and moves the kubo to the appropriate housekeeping state.

## Administrator workflow

### 7. Adjust rates

- [ ] Change a kubo type's nightly rate. Confirm the new rate is returned and the change is audited.
- [ ] Confirm existing assignments and reservations retain their original price snapshots.
- [ ] Create a new reservation after the rate change and confirm its new assignment uses the updated nightly rate.

### 8. Manage employees and roles

- [ ] Create an employee with a unique username and valid role. Confirm the password is not returned in the response or written to audit data.
- [ ] Update the employee's name, role, or status and reset the password. Confirm each operation is Administrator-only and audited.
- [ ] With one active Administrator, try creating or activating a second active Administrator. Confirm the change is rejected.
- [ ] Try deactivating, terminating, reassigning, or deleting the last active Administrator. Confirm the change is rejected.
- [ ] Try deleting a role that is still assigned to an employee. Confirm the deletion is rejected.

### 9. Review charge requests and manage the catalog

- [ ] Create a catalog item with an allowed category, unique name, optional description, non-negative unit price, and active status.
- [ ] Try a case-insensitive duplicate name, negative price, and price with more than two decimal places. Confirm each is rejected.
- [ ] Update the name, description, price, and active state. Confirm already-applied charges retain their recorded amounts.
- [ ] Delete an unused catalog item. Confirm the item is removed and the delete is audited.
- [ ] Apply a catalog item to a test reservation, then try to delete it. Confirm deletion is rejected with a conflict and the used item can be deactivated instead.
- [ ] Open **Charge requests** (`/charge-requests`). Review pending custom requests, approve one, adjust another with a reason, and reject another with a reason. Confirm all decisions are audited, only approvals create applied charges, and the Status filter shows reviewed, rejected, and withdrawn history.
- [ ] Approve an overpayment on a reservation, then revoke it while unused. Confirm the approval shows **Revoked**, a used approval cannot be revoked, and both actions are audited.

### 10. Inspect audit history and role boundaries

- [ ] Search audit logs by employee, action, entity type, entity ID, and date range. Open a record and confirm the actor, affected record, description, and before/after values are appropriate.
- [ ] Open entity history and confirm entries are newest first. Confirm sensitive data such as passwords and full guest ID numbers are not exposed.
- [ ] Try to update or delete an audit row through the application. Confirm no such write operation is available.
- [ ] Sign in as Staff and try an Administrator action such as catalog mutation, employee management, rate adjustment, request approval, or audit-log access. Confirm access is denied.
- [ ] Sign in as Administrator and try Staff-only reservation creation, check-in/check-out, catalog charge application, payment creation, or refund. Confirm access is denied.
- [ ] Sign out, then reuse the old token (for example from Postman). Confirm it is rejected with `401` while another signed-in session of the same employee keeps working.

## Business-rule guards

- [ ] **Overpayment:** verify a payment above the derived outstanding balance is rejected unless an unused Administrator overpayment approval covers the excess.
- [ ] **Settlement lock:** before settlement, verify Staff can remove an applied charge. After any completed payment/refund or a terminal reservation status (`CheckedOut`, `Cancelled`, or `NoShow`), verify deletion is blocked.
- [ ] **Last Administrator:** verify a second active Administrator is rejected and the last active Administrator cannot be deactivated, terminated, reassigned, or deleted.
- [ ] **Derived totals:** verify accommodation, applied charges, net paid, and outstanding balance change from their source records; do not expect a stored reservation total.
- [ ] **Audit atomicity:** after a rejected mutation, confirm neither partial business data nor a success audit event was committed.

## Known behavior to account for

- Pending, rejected, and withdrawn custom requests do not affect the balance.
- Completed `Adjustment`s reduce the outstanding balance and completed `Reversal`s restore it; neither changes cash net paid (G-07 resolved).
- An approved overpayment leaves a guest credit (negative balance). Check-out requires exactly ₱0.00, so refund the credit first.
