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
    label: 'Checked in',
    color: '#15803d',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  CheckedOut: {
    label: 'Checked out',
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
    label: 'No-show',
    color: '#4b5563',
    bgColor: '#f9fafb',
    borderColor: '#d1d5db',
  },
};

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  WalkIn: 'Walk-in',
  Online: 'Online',
  Phone: 'Phone',
  Email: 'Email',
  Facebook: 'Facebook',
  TravelAgency: 'Travel agency',
  Referral: 'Referral',
  Other: 'Other',
};

export const BOOKING_SOURCE_OPTIONS: Array<{ label: string; value: BookingSource }> = [
  { label: 'Walk-in', value: 'WalkIn' },
  { label: 'Online', value: 'Online' },
  { label: 'Phone', value: 'Phone' },
  { label: 'Email', value: 'Email' },
  { label: 'Facebook', value: 'Facebook' },
  { label: 'Travel agency', value: 'TravelAgency' },
  { label: 'Referral', value: 'Referral' },
  { label: 'Other', value: 'Other' },
];

export const STATUS_OPTIONS: Array<{ label: string; value: ReservationStatus }> = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Checked in', value: 'CheckedIn' },
  { label: 'Checked out', value: 'CheckedOut' },
  { label: 'Cancelled', value: 'Cancelled' },
  { label: 'No-show', value: 'NoShow' },
];

export const RESERVATION_LIMITS = {
  MAX_CANCELLATION_REASON: 255,
} as const;

export const RESERVATION_POLICIES = {
  OVERLAP_NOTICE:
    'A kubo can’t be booked twice for overlapping dates. Conflicting bookings are rejected.',
  RATE_SNAPSHOT:
    'Each kubo keeps the nightly rate from the time of booking. Later rate changes don’t affect this reservation.',
  BALANCE_DERIVED:
    'The balance is accommodation plus applied charges, minus what has been paid.',
} as const;
