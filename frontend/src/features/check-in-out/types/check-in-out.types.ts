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

export interface RecordPaymentPayload {
  reservationId: string;
  employeeId: string;
  paymentAmount: number;
  transactionType: 'payment';
  paymentType: 'deposit' | 'partial' | 'full' | 'balance' | 'additional';
  paymentMethod: 'cash' | 'credit card' | 'debit card' | 'gcash' | 'maya' | 'bank transfer' | 'online banking';
  paymentStatus: 'completed';
  paymentDate: string;
}
