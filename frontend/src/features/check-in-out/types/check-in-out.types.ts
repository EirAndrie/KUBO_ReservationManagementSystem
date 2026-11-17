import type { Reservation, ReservationAssignment } from '@/features/reservation';

export interface CheckInOutActionParams {
  reservationId: string;
  kuboId: string;
}

/**
 * Early check-in and late check-out fees for one kubo (issue #107). Money values
 * are decimal strings. When `*_applied` is true the hours and fee are what was
 * billed; otherwise they are what would apply right now (past 12:00, resort time,
 * at `hourly_rate` per hour or part of an hour).
 */
export interface TimeFees {
  hourly_rate: string;
  early_hours: number;
  early_fee: string;
  early_applied: boolean;
  late_hours: number;
  late_fee: string;
  late_applied: boolean;
}

export interface ArrivalRecord {
  reservation: Reservation;
  assignment: ReservationAssignment;
  isEarly: boolean;
  /** Check-in date has passed without check-in (shown on today's queue only). */
  isOverdue: boolean;
  canCheckIn: boolean;
}

export interface DepartureRecord {
  reservation: Reservation;
  assignment: ReservationAssignment;
  /** Check-out date has passed while still checked in (shown on today's queue only). */
  isOverdue: boolean;
  outstandingBalance: number;
  isSettled: boolean;
  canCheckOut: boolean;
}

export interface InHouseRecord {
  reservation: Reservation;
  assignment: ReservationAssignment;
  outstandingBalance: number;
}
