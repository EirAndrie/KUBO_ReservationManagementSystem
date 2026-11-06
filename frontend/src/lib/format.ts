import dayjs from 'dayjs';

/**
 * Shared display helpers. Money and dates are formatted in one place so every
 * page shows them the same way, and enum values never reach the UI raw.
 */

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pesoWholeFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Parses API money values, which arrive as numbers or numeric strings. */
export function toAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** `₱1,234.00` (tables, ledgers). */
export function formatMoney(value: unknown): string {
  return pesoFormatter.format(toAmount(value));
}

/** `₱1,234` (KPI tiles). */
export function formatMoneyWhole(value: unknown): string {
  return pesoWholeFormatter.format(Math.round(toAmount(value)));
}

/** Signed money, e.g. `−₱1,500.00` for refunds. */
export function formatSignedMoney(value: number): string {
  return value < 0 ? `−${formatMoney(Math.abs(value))}` : formatMoney(value);
}

export function formatDate(value?: string | null, pattern = 'MMM D, YYYY'): string {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format(pattern) : '—';
}

export function formatDateTime(value?: string | null): string {
  return formatDate(value, 'MMM D, h:mm A');
}

/** Nights between two ISO dates (never negative). */
export function nightsBetween(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const n = dayjs(checkOut).startOf('day').diff(dayjs(checkIn).startOf('day'), 'day');
  return Math.max(0, n);
}

/** `Nov 5 → 7` or `Nov 30 → Dec 2`. */
export function formatStayRange(checkIn?: string | null, checkOut?: string | null): string {
  if (!checkIn || !checkOut) return '—';
  const a = dayjs(checkIn);
  const b = dayjs(checkOut);
  if (!a.isValid() || !b.isValid()) return '—';
  const end = a.month() === b.month() && a.year() === b.year() ? b.format('D') : b.format('MMM D');
  return `${a.format('MMM D')} → ${end}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Turns `CheckedIn`, `on_leave` or `extra bed` into `Checked in`, `On leave`, `Extra bed`. */
export function humanize(value?: string | null): string {
  if (!value) return '—';
  const spaced = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Human labels for every enum shown in the UI. Values not listed fall back to
 * `humanize`, so a new backend value still reads naturally.
 */
const LABELS: Record<string, string> = {
  // Reservation
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  CheckedIn: 'Checked in',
  CheckedOut: 'Checked out',
  Cancelled: 'Cancelled',
  NoShow: 'No-show',
  // Booking source
  WalkIn: 'Walk-in',
  Online: 'Online',
  Phone: 'Phone',
  Email: 'Email',
  Facebook: 'Facebook',
  TravelAgency: 'Travel agency',
  Referral: 'Referral',
  // Kubo
  Available: 'Available',
  Reserved: 'Reserved',
  Occupied: 'Occupied',
  Cleaning: 'Cleaning',
  Maintenance: 'Maintenance',
  UnderInspection: 'Under inspection',
  OutOfService: 'Out of service',
  // Payment
  Processing: 'Processing',
  Completed: 'Completed',
  Failed: 'Failed',
  Refunded: 'Refunded',
  PartiallyRefunded: 'Partially refunded',
  Payment: 'Payment',
  Refund: 'Refund',
  Adjustment: 'Adjustment',
  Reversal: 'Reversal',
  Deposit: 'Deposit',
  PartialPayment: 'Partial payment',
  FullPayment: 'Full payment',
  BalancePayment: 'Balance payment',
  AdditionalCharge: 'Additional charge',
  Cash: 'Cash',
  CreditCard: 'Credit card',
  DebitCard: 'Debit card',
  GCash: 'GCash',
  Maya: 'Maya',
  BankTransfer: 'Bank transfer',
  OnlineBanking: 'Online banking',
  // Employee
  Active: 'Active',
  Inactive: 'Inactive',
  Suspended: 'Suspended',
  OnLeave: 'On leave',
  Terminated: 'Terminated',
  // Charge requests
  Approved: 'Approved',
  Rejected: 'Rejected',
  Withdrawn: 'Withdrawn',
  // ID types
  DriverLicense: "Driver's license",
  NationalID: 'National ID',
  PhilHealthID: 'PhilHealth ID',
  SSSID: 'SSS ID',
  UMID: 'UMID',
  PostalID: 'Postal ID',
  PRCID: 'PRC ID',
  VotersID: "Voter's ID",
  SeniorCitizenID: 'Senior citizen ID',
  StudentID: 'Student ID',
  Passport: 'Passport',
  Other: 'Other',
};

export function label(value?: string | null): string {
  if (!value) return '—';
  return LABELS[value] ?? humanize(value);
}

/** `•••• 4000` — the last four characters only. */
export function maskId(value?: string | null): string {
  if (!value) return '—';
  const tail = value.slice(-4);
  return `•••• ${tail}`;
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}
