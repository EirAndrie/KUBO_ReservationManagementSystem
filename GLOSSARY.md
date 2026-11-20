# Kubo Reservation System

Staff use this system to register guests, reserve kubos, take payments, and check guests in and out of a small beach resort. This glossary adds the words to avoid to the Terminology table in `docs/business_rules.md` section 2. If the two disagree, `docs/business_rules.md` wins.

## People

**Employee**:
A person who signs in to the system. Every employee has exactly one role.
_Avoid_: user, account

**Administrator**:
The role that manages employees, roles, kubo types, kubos, rates, and corrections. It does not do daily staff work.
_Avoid_: owner, admin user

**Staff**:
The role that handles guests, reservations, charges, payments, and check-in and check-out.
_Avoid_: front desk, cashier

**Guest**:
The person a reservation is made for.
_Avoid_: customer, client

## Accommodation

**Kubo type**:
An accommodation category with a capacity and a nightly price.
_Avoid_: room type, category

**Kubo**:
One rentable accommodation unit.
_Avoid_: room, cottage, unit

**Price per night**:
The only rate a kubo type has. Each reserved kubo keeps a copy of it, `price_at_booking`, from the time it was assigned.
_Avoid_: rate (used alone), room rate

## Reservations

**Reservation**:
The record for one guest's stay, created by one staff member. It holds one or more reserved kubos.
_Avoid_: booking (except the `booking_source` field name)

**Reserved kubo**:
One kubo assigned to a reservation for a date range.
_Avoid_: assignment, room booking

**Reference code**:
The unique code the system gives a reservation when it is created. It never changes.
_Avoid_: reservation number, booking ID

**No-show**:
A confirmed reservation whose guest never checked in. It is final.
_Avoid_: cancelled (they are different statuses)

## Money

**Additional charge**:
An extra amount billed to a reservation, such as an extra bed, damage, or late check-out.
_Avoid_: fee, add-on, extra

**Payment**:
Any money record on a reservation. Its transaction type is Payment, Refund, Adjustment, or Reversal.
_Avoid_: transaction (used alone)

**Refund**:
Money returned to the guest against a completed payment of the same reservation.
_Avoid_: reversal, return

**Adjustment**:
A non-cash credit that lowers what the guest still owes. It does not change the amount paid.
_Avoid_: discount, correction

**Reversal**:
A record that cancels out an earlier Adjustment, so the guest owes that amount again.
_Avoid_: refund, void

**Overpayment approval**:
An Administrator's approval that lets Staff record one payment above the balance due.
_Avoid_: override

## Records

**Audit log**:
The append-only record of significant actions done by employees.
_Avoid_: history, activity log

**BR-NNN**:
A business rule in `docs/business_rules.md`, for example BR-031.
_Avoid_: rule number

**G-NN**:
A known design gap listed in `docs/business_rules.md` section 14, for example G-08.
_Avoid_: bug, issue
