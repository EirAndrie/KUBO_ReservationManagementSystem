import dayjs from 'dayjs';
import { nightsBetween, toAmount } from '@/lib/format';
import type { Reservation, ReservationAssignment, ReservationStatus } from '../types/reservation.types';

/** Statuses after which nothing more can happen to a reservation. */
export const TERMINAL_STATUSES: ReservationStatus[] = ['CheckedOut', 'Cancelled', 'NoShow'];

export interface StaySummary {
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
}

/**
 * The overall stay of a reservation: earliest check-in and latest check-out
 * across its kubo assignments (dates are nested in `assignments`, not top level).
 */
export function stayOf(assignments: ReservationAssignment[] | undefined | null): StaySummary {
  const list = assignments ?? [];
  if (list.length === 0) return { checkIn: null, checkOut: null, nights: 0 };
  let checkIn = list[0].check_in_date;
  let checkOut = list[0].check_out_date;
  for (const a of list) {
    if (dayjs(a.check_in_date).isBefore(dayjs(checkIn))) checkIn = a.check_in_date;
    if (dayjs(a.check_out_date).isAfter(dayjs(checkOut))) checkOut = a.check_out_date;
  }
  return { checkIn, checkOut, nights: nightsBetween(checkIn, checkOut) };
}

/** Billed nights summed per assignment (a two-kubo stay counts both). */
export function billedNights(assignments: ReservationAssignment[] | undefined | null): number {
  return (assignments ?? []).reduce((sum, a) => sum + nightsBetween(a.check_in_date, a.check_out_date), 0);
}

/** Balance due straight from the API (`outstanding_balance`); never recomputed here. */
export function balanceOf(reservation: Pick<Reservation, 'outstanding_balance'>): number {
  return toAmount(reservation.outstanding_balance);
}

export function isTerminal(status: ReservationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
