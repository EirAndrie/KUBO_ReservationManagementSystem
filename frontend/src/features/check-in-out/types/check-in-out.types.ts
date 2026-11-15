import type { Reservation, ReservationAssignment } from '@/features/reservation';

export interface CheckInOutActionParams {
  reservationId: string;
  kuboId: string;
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
