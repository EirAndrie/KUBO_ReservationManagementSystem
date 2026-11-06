import React from 'react';
import { label } from '@/lib/format';
import styles from './common.module.css';

export type StatusTone = 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'gray';

/**
 * Color meaning (design tokens): green = done/good, blue = scheduled,
 * amber = needs action, red = blocked/failed, violet = occupied,
 * gray = finished/inactive. Unknown values fall back to gray.
 */
const TONES: Record<string, StatusTone> = {
  // Reservation
  Pending: 'amber',
  Confirmed: 'blue',
  CheckedIn: 'green',
  CheckedOut: 'gray',
  Cancelled: 'red',
  NoShow: 'gray',
  // Kubo
  Available: 'green',
  Reserved: 'blue',
  Occupied: 'violet',
  Cleaning: 'amber',
  Maintenance: 'red',
  UnderInspection: 'amber',
  OutOfService: 'gray',
  // Payment
  Processing: 'blue',
  Completed: 'green',
  Failed: 'red',
  Refunded: 'gray',
  PartiallyRefunded: 'gray',
  // Employee
  Active: 'green',
  OnLeave: 'amber',
  Suspended: 'red',
  Inactive: 'gray',
  Terminated: 'gray',
  // Charges / requests
  Applied: 'green',
  Approved: 'violet',
  Rejected: 'red',
  Withdrawn: 'gray',
  // Kubo readiness
  Ready: 'green',
};

export interface StatusBadgeProps {
  status: string;
  /** Overrides the visible text; the tone still comes from `status`. */
  text?: string;
  tone?: StatusTone;
  className?: string;
}

/** The one status component for reservations, kubos, payments and employees. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text, tone, className }) => {
  const resolved = tone ?? TONES[status] ?? 'gray';
  return (
    <span className={`${styles.badge} ${styles[resolved]} ${className ?? ''}`}>
      <span className={styles.badgeDot} aria-hidden="true" />
      {text ?? label(status)}
    </span>
  );
};
