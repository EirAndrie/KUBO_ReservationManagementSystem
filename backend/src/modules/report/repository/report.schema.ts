import { z } from "zod";

/** `GET /reports/daily` query: an optional resort calendar date. */
export const DailyReportQuerySchema = z.object({
      date: z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
            .refine(
                  (value) => {
                        const parsed = new Date(`${value}T00:00:00Z`);
                        return (
                              !Number.isNaN(parsed.getTime()) &&
                              parsed.toISOString().slice(0, 10) === value
                        );
                  },
                  { message: "date is not a valid calendar date" },
            )
            .optional(),
});

export interface DailyCollectionRow {
      payment_method: string;
      payments_count: number;
      collected: string;
      refunds_count: number;
      refunded: string;
      net: string;
      pending_count: number;
      pending_amount: string;
}

export interface DailyDepartureRow {
      reservation_id: string;
      reference_code: string;
      guest_name: string;
      kubo_id: string;
      kubo_number: string;
      check_out_date: string;
      scheduled_check_out_time: string | null;
      assignment_status: "Reserved" | "CheckedIn" | "CheckedOut";
      actual_check_out_datetime: string | null;
      /** Still CheckedIn after check_out_date (today's report only). */
      overdue: boolean;
      outstanding_balance: string;
}

export interface DailyOccupancyRow {
      report_date: string;
      total_kubos: number;
      booked_kubos: number;
      arrivals: number;
      departures: number;
}

export interface DailyCollectionTotals {
      payments_count: number;
      collected: string;
      refunds_count: number;
      refunded: string;
      net: string;
      pending_count: number;
      pending_amount: string;
}

export interface DailyReport {
      date: string;
      timeZone: string;
      collections: {
            byMethod: DailyCollectionRow[];
            totals: DailyCollectionTotals;
      };
      occupancy: DailyOccupancyRow;
      departures: DailyDepartureRow[];
}
