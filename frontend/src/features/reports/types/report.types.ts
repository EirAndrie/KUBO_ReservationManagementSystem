/**
 * `GET /reports/daily` response (backend `report/API_CONTRACT.md`). Money
 * values are decimal strings from PostgreSQL; display them with `formatMoney`
 * and never recompute balances here.
 */

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

export interface DailyCollectionTotals {
  payments_count: number;
  collected: string;
  refunds_count: number;
  refunded: string;
  net: string;
  pending_count: number;
  pending_amount: string;
}

export interface DailyDeparture {
  reservation_id: string;
  reference_code: string;
  guest_name: string;
  kubo_id: string;
  kubo_number: string;
  check_out_date: string;
  scheduled_check_out_time: string | null;
  assignment_status: 'Reserved' | 'CheckedIn' | 'CheckedOut';
  actual_check_out_datetime: string | null;
  /** Still checked in after the scheduled check-out date (today's report only). */
  overdue: boolean;
  outstanding_balance: string;
}

export interface DailyOccupancy {
  report_date: string;
  total_kubos: number;
  booked_kubos: number;
  arrivals: number;
  departures: number;
}

export interface DailyReport {
  date: string;
  timeZone: string;
  collections: {
    byMethod: DailyCollectionRow[];
    totals: DailyCollectionTotals;
  };
  occupancy: DailyOccupancy;
  departures: DailyDeparture[];
}
