import React from 'react';
import { StatusBadge } from '@/components/common';
import type { ReservationStatus } from '../types/reservation.types';

export interface ReservationStatusTagProps {
  status: ReservationStatus;
  style?: React.CSSProperties;
}

/** Reservation status, rendered with the shared StatusBadge (dot + label). */
export const ReservationStatusTag: React.FC<ReservationStatusTagProps> = ({ status }) => (
  <StatusBadge status={status} />
);
