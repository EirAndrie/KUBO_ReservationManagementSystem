/**
 * Types and DTOs for the Guest Management feature module.
 * Aligns strictly with backend schemas and business rules (BR-009 through BR-015).
 */

export const VALID_ID_TYPES = [
  'Passport',
  'DriverLicense',
  'NationalID',
  'PhilHealthID',
  'SSSID',
  'UMID',
  'PostalID',
  'PRCID',
  'VotersID',
  'SeniorCitizenID',
  'StudentID',
  'Other',
] as const;

export type ValidIdType = (typeof VALID_ID_TYPES)[number];

export interface Guest {
  guest_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  valid_id_type: ValidIdType;
  id_number: string;
  address_line_1?: string | null;
  city?: string | null;
  state_province?: string | null;
  zip_postal_code?: string | null;
  country?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GuestFilterParams {
  search?: string;
  validIdType?: ValidIdType;
  limit?: number;
  offset?: number;
}

export interface CreateGuestDTO {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  validIdType: ValidIdType;
  idNumber: string;
  addressLine1?: string;
  city?: string;
  stateProvince?: string;
  zipPostalCode?: string;
  country?: string;
}

export interface UpdateGuestDTO {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  validIdType?: ValidIdType;
  idNumber?: string;
  addressLine1?: string;
  city?: string;
  stateProvince?: string;
  zipPostalCode?: string;
  country?: string;
}

export interface GuestsApiResponse {
  success: boolean;
  count: number;
  message: string;
  guests: Guest[];
}

export interface SingleGuestApiResponse {
  success: boolean;
  message: string;
  reused?: boolean;
  guests: Guest;
}

/**
 * Reservation record linked to a guest for history tracking.
 */
export interface GuestReservationHistoryItem {
  reservation_id: string;
  guest_id: string;
  employee_id: string;
  status: 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled' | 'NoShow';
  booking_source: string;
  check_in_date: string;
  check_out_date: string;
  total_nights?: number;
  created_at: string;
  updated_at?: string;
  reserved_kubos?: Array<{
    reserved_kubo_id: string;
    kubo_id: string;
    kubo_number?: string;
    type_name?: string;
    price_at_booking: number | string;
    status: string;
  }>;
}

export interface GuestReservationsApiResponse {
  success: boolean;
  count: number;
  message: string;
  reservations: GuestReservationHistoryItem[];
}
