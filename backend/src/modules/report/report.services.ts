import { getDailyReport } from "./repository/report.repository";
import type {
      DailyCollectionRow,
      DailyReport,
} from "./repository/report.schema";

const RESORT_TIME_ZONE = "Asia/Manila";

/** Adds 2-decimal money strings from PostgreSQL exactly, in centavos. */
const sumMoney = (values: string[]): string => {
      const centavos = values.reduce(
            (total, value) => total + Math.round(Number(value) * 100),
            0,
      );
      return (centavos / 100).toFixed(2);
};

const sumCount = (
      rows: DailyCollectionRow[],
      key: "payments_count" | "refunds_count" | "pending_count",
) => rows.reduce((total, row) => total + row[key], 0);

/**
 * Builds the Administrator end-of-day report for one resort calendar date:
 * collections by payment method with day totals, occupancy for that night,
 * and the day's departures with each reservation's derived outstanding
 * balance. Read-only; no audit row.
 */
export const getDailyReportService = async (
      date?: string,
): Promise<DailyReport> => {
      const { collections, departures, occupancy } = await getDailyReport(
            date ?? null,
      );

      return {
            date: occupancy.report_date,
            timeZone: RESORT_TIME_ZONE,
            collections: {
                  byMethod: collections,
                  totals: {
                        payments_count: sumCount(collections, "payments_count"),
                        collected: sumMoney(collections.map((r) => r.collected)),
                        refunds_count: sumCount(collections, "refunds_count"),
                        refunded: sumMoney(collections.map((r) => r.refunded)),
                        net: sumMoney(collections.map((r) => r.net)),
                        pending_count: sumCount(collections, "pending_count"),
                        pending_amount: sumMoney(
                              collections.map((r) => r.pending_amount),
                        ),
                  },
            },
            occupancy,
            departures,
      };
};
