import type { Reservation, ReservationAssignment } from '@/features/reservation';

export interface CheckInOutActionParams {
  reservationId: string;
  kuboId: string;
}

export interface ArrivalRecord {
  reservation: Reservation;
  assignment: ReservationAssignment;
  isEarly: boolean;
  canCheckIn: boolean;
}

export interface DepartureRecord {
  reservation: Reservation;
  assignment: ReservationAssignment;
  outstandingBalance: number;
  isSettled: boolean;
  canCheckOut: boolean;
}

export interface InHouseRecord {
  reservation: Reservation;
  assignment: ReservationAssignment;
  outstandingBalance: number;
}
