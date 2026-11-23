import type { PoolClient } from "pg";
import { db } from "../config/connectDB";

/**
 * Checks the overstay billing routines (`20261124_bound_late_check_out_fee.sql`)
 * against a test database.
 *
 * The API refuses past stay dates, so Postman cannot create a guest who is
 * still checked in after the check-out date. This script inserts one directly
 * and calls the stored functions the API uses, then rolls everything back so the
 * database is left unchanged.
 *
 * It checks that, for a guest 3 days past check-out at PHP 1,000 per night:
 * the preview is 12 hours plus 3 nights; check-out is refused until the fee is
 * applied; applying writes a 12-hour `LateCheckOut` and a 3-night `Other` charge;
 * when the overstay grows by one day the preview becomes unapplied, check-out is
 * refused again, and a second apply tops the nights up to 4; applying again
 * changes nothing.
 *
 * Safety: refuses to run unless `DB_NAME` ends in `_test`. Needs at least one
 * employee, one guest and one `Available` kubo in that database.
 *
 * Run with `npm run db:verify-overstay` from `backend/`, with `DB_NAME` set to the
 * test database (for example `DB_NAME=kubo_beach_resort_system_test`).
 */

const HOURLY_RATE = 150;
const NIGHTLY_RATE = 1000;
const HOURS_CAP = 12;

interface TimeFees {
      late_hours: number;
      late_fee: string;
      late_applied: boolean;
}

let failures = 0;

function check(label: string, ok: boolean, detail?: unknown): void {
      if (!ok) failures += 1;
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : ` -> ${JSON.stringify(detail)}`}`);
}

/** Runs `sql` inside a savepoint and returns the error message, or null on success. */
async function errorOf(client: PoolClient, sql: string, params: unknown[]): Promise<string | null> {
      await client.query("SAVEPOINT attempt");
      try {
            await client.query(sql, params);
            await client.query("RELEASE SAVEPOINT attempt");
            return null;
      } catch (error) {
            await client.query("ROLLBACK TO SAVEPOINT attempt");
            return error instanceof Error ? error.message : String(error);
      }
}

async function main(): Promise<void> {
      const dbName = process.env.DB_NAME ?? "";
      if (!dbName.endsWith("_test")) {
            throw new Error(`Refusing to run: DB_NAME "${dbName}" is not a test database (must end in "_test").`);
      }

      const client = await db.connect();
      try {
            await client.query("BEGIN");

            const employee = (await client.query("SELECT employee_id FROM kubo.employee LIMIT 1")).rows[0];
            const guest = (await client.query("SELECT guest_id FROM kubo.guest LIMIT 1")).rows[0];
            const kubo = (await client.query("SELECT kubo_id FROM kubo.kubo WHERE status = 'Available' LIMIT 1")).rows[0];
            if (!employee || !guest || !kubo) {
                  throw new Error("The test database needs an employee, a guest and an Available kubo.");
            }

            const reservationId: string = (
                  await client.query(
                        `INSERT INTO kubo.reservation (reference_code, guest_id, employee_id, booking_source, status)
                         VALUES ('OVERSTAYCHK', $1, $2, 'WalkIn', 'CheckedIn')
                         RETURNING reservation_id`,
                        [guest.guest_id, employee.employee_id],
                  )
            ).rows[0].reservation_id;

            await client.query(
                  `INSERT INTO kubo.reserved_kubo
                         (reservation_id, kubo_id, check_in_date, check_out_date, price_at_booking, status)
                   VALUES ($1, $2, CURRENT_DATE - 5, CURRENT_DATE - 3, $3, 'CheckedIn')`,
                  [reservationId, kubo.kubo_id, NIGHTLY_RATE],
            );

            const ids = [reservationId, kubo.kubo_id];
            const actor = [...ids, employee.employee_id];
            const checkOut = "SELECT kubo_reservation_management.fn_check_out_reserved_kubo($1, $2, $3)";
            const apply = "SELECT * FROM kubo_reservation_management.fn_apply_late_check_out_fee($1, $2, $3)";
            const preview = async (): Promise<TimeFees> =>
                  (
                        await client.query(
                              "SELECT late_hours, late_fee, late_applied FROM kubo_reservation_management.fn_get_time_fees($1, $2)",
                              ids,
                        )
                  ).rows[0];
            const charges = async () =>
                  (
                        await client.query(
                              `SELECT charge_type, quantity, amount::numeric AS amount
                               FROM kubo.additional_charge WHERE reservation_id = $1 ORDER BY charge_type`,
                              [reservationId],
                        )
                  ).rows;

            const hoursFee = HOURS_CAP * HOURLY_RATE;

            let fees = await preview();
            check(
                  "preview: 12 hours plus 3 nights, not yet applied",
                  fees.late_hours === HOURS_CAP && Number(fees.late_fee) === hoursFee + 3 * NIGHTLY_RATE && !fees.late_applied,
                  fees,
            );

            const beforeFee = await errorOf(client, checkOut, actor);
            check("check-out is refused before the fee is applied", /late check-out fee applies/i.test(beforeFee ?? ""), beforeFee);

            const applied = (await client.query(apply, actor)).rows[0];
            check(
                  "apply returns 12 hours and PHP 4,800",
                  applied.hours === HOURS_CAP && Number(applied.amount) === hoursFee + 3 * NIGHTLY_RATE,
                  applied,
            );

            const rows = await charges();
            const late = rows.find((r) => r.charge_type === "LateCheckOut");
            const nights = rows.find((r) => r.charge_type === "Other");
            check("one 12-hour LateCheckOut charge", rows.length === 2 && late?.quantity === HOURS_CAP && Number(late.amount) === hoursFee, rows);
            check("one 3-night overstay charge", nights?.quantity === 3 && Number(nights.amount) === 3 * NIGHTLY_RATE, rows);

            fees = await preview();
            check("preview after apply is applied", fees.late_applied, fees);

            const unpaid = await errorOf(client, checkOut, actor);
            check("check-out then waits on the balance, not the fee", /Outstanding balance must be zero/i.test(unpaid ?? ""), unpaid);

            await client.query(
                  "UPDATE kubo.reserved_kubo SET check_out_date = CURRENT_DATE - 4 WHERE reservation_id = $1",
                  [reservationId],
            );

            fees = await preview();
            check(
                  "overstay grew: preview is unapplied at PHP 5,800",
                  !fees.late_applied && Number(fees.late_fee) === hoursFee + 4 * NIGHTLY_RATE,
                  fees,
            );

            const stale = await errorOf(client, checkOut, actor);
            check("check-out is refused until the extra night is billed", /past the check-out date/i.test(stale ?? ""), stale);

            const topped = (await client.query(apply, actor)).rows[0];
            check("top-up apply returns PHP 5,800", Number(topped.amount) === hoursFee + 4 * NIGHTLY_RATE, topped);

            const again = (await client.query(apply, actor)).rows[0];
            const finalRows = await charges();
            check(
                  "applying again changes nothing",
                  Number(again.amount) === hoursFee + 4 * NIGHTLY_RATE && finalRows.length === 2,
                  { again, finalRows },
            );
      } finally {
            await client.query("ROLLBACK");
            client.release();
            await db.end();
      }

      console.log(failures === 0 ? "\nAll checks passed. Nothing was saved." : `\n${failures} check(s) failed. Nothing was saved.`);
      process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
});
