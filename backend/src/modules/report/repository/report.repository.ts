import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";
import type {
      DailyCollectionRow,
      DailyDepartureRow,
      DailyOccupancyRow,
} from "./report.schema";

/**
 * Reads the three parts of the end-of-day report for one resort calendar date
 * (migration `20261116_add_daily_summary_report.sql`). A null `date` means
 * today in Asia/Manila; the occupancy row reports which date was used.
 *
 * The read-only functions run in one `REPEATABLE READ` transaction so every
 * part describes the same snapshot (a payment recorded mid-report cannot
 * appear in one part and not another).
 */
export const getDailyReport = async (
      date: string | null,
): Promise<{
      collections: DailyCollectionRow[];
      departures: DailyDepartureRow[];
      occupancy: DailyOccupancyRow;
}> => {
      const client = await db.connect();
      try {
            await client.query(
                  "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
            );
            const collections = await client.query<DailyCollectionRow>(
                  `SELECT * FROM kubo_payment_management.fn_get_daily_collections($1::date)`,
                  [date],
            );
            const departures = await client.query<DailyDepartureRow>(
                  `
                  SELECT
                        reservation_id,
                        reference_code,
                        guest_name,
                        kubo_id,
                        kubo_number,
                        to_char(check_out_date, 'YYYY-MM-DD') AS check_out_date,
                        scheduled_check_out_time::text AS scheduled_check_out_time,
                        assignment_status,
                        actual_check_out_datetime,
                        outstanding_balance
                  FROM kubo_reservation_management.fn_get_daily_departures($1::date)
                  `,
                  [date],
            );
            const occupancy = await client.query<DailyOccupancyRow>(
                  `
                  SELECT
                        to_char(report_date, 'YYYY-MM-DD') AS report_date,
                        total_kubos,
                        booked_kubos,
                        arrivals,
                        departures
                  FROM kubo_reservation_management.fn_get_daily_occupancy($1::date)
                  `,
                  [date],
            );
            await client.query("COMMIT");
            return {
                  collections: collections.rows,
                  departures: departures.rows,
                  occupancy: occupancy.rows[0],
            };
      } catch (error: any) {
            await client.query("ROLLBACK").catch(() => undefined);
            logger.error("Failed to load daily report from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to load daily report");
      } finally {
            client.release();
      }
};
