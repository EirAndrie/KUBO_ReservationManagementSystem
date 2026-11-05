import type { ReservationStatus, BookingSource } from '../types/reservation.types';

export const STATUS_CONFIG: Record<
  ReservationStatus,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  Pending: {
    label: 'Pending',
    color: '#a16207',
    bgColor: '#fefce8',
    borderColor: '#fde047',
  },
  Confirmed: {
    label: 'Confirmed',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  CheckedIn: {
    label: 'Checked In',
    color: '#15803d',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  CheckedOut: {
    label: 'Checked Out',
    color: '#6d28d9',
    bgColor: '#f5f3ff',
    borderColor: '#c4b5fd',
  },
  Cancelled: {
    label: 'Cancelled',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  NoShow: {
    label: 'No Show',
    color: '#4b5563',
    bgColor: '#f9fafb',
    borderColor: '#d1d5db',
  },
};

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  WalkIn: 'Walk-In',
  Online: 'Online',
  Phone: 'Phone Call',
  Email: 'Email',
  Facebook: 'Facebook',
  TravelAgency: 'Travel Agency',
  Referral: 'Referral',
  Other: 'Other',
};

export const BOOKING_SOURCE_OPTIONS: Array<{ label: string; value: BookingSource }> = [
  { label: 'Walk-In', value: 'WalkIn' },
  { label: 'Online', value: 'Online' },
  { label: 'Phone Call', value: 'Phone' },
  { label: 'Email', value: 'Email' },
  { label: 'Facebook', value: 'Facebook' },
  { label: 'Travel Agency', value: 'TravelAgency' },
  { label: 'Referral', value: 'Referral' },
  { label: 'Other', value: 'Other' },
];

export const STATUS_OPTIONS: Array<{ label: string; value: ReservationStatus }> = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Checked In', value: 'CheckedIn' },
  { label: 'Checked Out', value: 'CheckedOut' },
  { label: 'Cancelled', value: 'Cancelled' },
  { label: 'No Show', value: 'NoShow' },
];

export const RESERVATION_LIMITS = {
  MAX_CANCELLATION_REASON: 255,
} as const;

export const RESERVATION_POLICIES = {
  OVERLAP_NOTICE:
    'Each kubo assignment is validated atomically for date overlap. Conflicting reservations are rejected at the database level (BR-031, BR-032).',
  RATE_SNAPSHOT:
    'The nightly rate at the time of booking is captured in price_at_booking. Future rate changes do not affect existing reservations (BR-020).',
  BALANCE_DERIVED:
    'Outstanding balance is computed dynamically: Accommodation Total + Additional Charges - Net Paid. No stored balance column exists (BR-040, BR-047).',
} as const;
