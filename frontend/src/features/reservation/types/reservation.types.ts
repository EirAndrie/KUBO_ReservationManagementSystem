/**
 * Domain types and DTOs for the Reservation feature module.
 * Strictly aligned with backend schemas (reservation.schema.ts).
 */

export const RESERVATION_STATUSES = [
  'Pending',
  'Confirmed',
  'CheckedIn',
  'CheckedOut',
  'Cancelled',
  'NoShow',
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const BOOKING_SOURCES = [
  'WalkIn',
  'Online',
  'Phone',
  'Email',
  'Facebook',
  'TravelAgency',
  'Referral',
  'Other',
] as const;

export type BookingSource = (typeof BOOKING_SOURCES)[number];

export interface ReservationAssignment {
  reserved_kubo_id?: string;
  kubo_id: string;
  kubo_number?: string;
  type_name?: string;
  capacity?: number;
  price_at_booking: number | string;
  check_in_date: string;
  check_out_date: string;
  scheduled_check_in_time?: string | null;
  scheduled_check_out_time?: string | null;
  actual_check_in_datetime?: string | null;
  actual_check_out_datetime?: string | null;
  early_check_in_approved?: boolean;
  status?: string;
}

export interface Reservation {
  reservation_id: string;
  reference_code: string;
  guest_id: string;
  guest_name: string;
  employee_id: string;
  employee_name: string;
  status: ReservationStatus;
  booking_source: BookingSource;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  reserved_at: string;
  accommodation_total: string;
  charges_total: string;
  net_paid: string;
  outstanding_balance: string;
  assignments: ReservationAssignment[];
}

export interface ReservationFilterParams {
  status?: ReservationStatus;
  bookingSource?: BookingSource;
  search?: string;
  guestId?: string;
  employeeId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  limit?: number;
  offset?: number;
}

export interface CreateAssignmentDTO {
  kuboId: string;
  checkInDate: string;
  checkOutDate: string;
  scheduledCheckInTime?: string;
  scheduledCheckOutTime?: string;
}

export interface CreateReservationDTO {
  guestId: string;
  employeeId: string;
  bookingSource: BookingSource;
  assignments: CreateAssignmentDTO[];
}

export interface UpdateReservationDTO {
  guestId?: string;
  bookingSource?: BookingSource;
}

export interface CancelReservationDTO {
  reason: string;
}

export interface ReservationsApiResponse {
  success: boolean;
  count: number;
  message: string;
  reservations: Reservation[];
}

export interface SingleReservationApiResponse {
  success: boolean;
  message: string;
  reservations: Reservation;
}

/** Available Kubo returned from GET /api/kubos/available */
export interface AvailableKubo {
  kubo_id: string;
  kubo_number: string;
  kubo_type_id: string;
  type_name: string;
  capacity: number;
  price_per_night: number | string;
  status: string;
}

export interface AvailableKubosApiResponse {
  success: boolean;
  message: string;
  kubos: AvailableKubo[];
}

export interface PaymentItem {
  payment_id: string;
  reservation_id: string;
  /** Backend field (a numeric string). */
  payment_amount?: number | string;
  /** Legacy fallback; read `payment_amount` first. */
  amount?: number | string;
  payment_method: string;
  transaction_type: string;
  payment_date: string;
  reference_number?: string | null;
  notes?: string | null;
}

export interface AdditionalChargeItem {
  charge_id: string;
  reservation_id: string;
  charge_type: string;
  amount: number | string;
  description?: string | null;
  charged_at: string;
}

