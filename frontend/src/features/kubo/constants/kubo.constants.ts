import type { KuboStatus } from '../types/kubo.types';

export const KUBO_STATUS_LABELS: Record<KuboStatus, string> = {
  Available: 'Available',
  Reserved: 'Reserved',
  Occupied: 'Occupied',
  Cleaning: 'Cleaning / Housekeeping',
  Maintenance: 'Under Maintenance',
  UnderInspection: 'Under Inspection',
  OutOfService: 'Out of Service',
};

export const KUBO_STATUS_TAGS: Record<KuboStatus, { color: string; bg?: string }> = {
  Available: { color: 'success' },
  Reserved: { color: 'blue' },
  Occupied: { color: 'purple' },
  Cleaning: { color: 'gold' },
  Maintenance: { color: 'volcano' },
  UnderInspection: { color: 'cyan' },
  OutOfService: { color: 'error' },
};

export const KUBO_STATUS_OPTIONS = Object.entries(KUBO_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as KuboStatus,
    label,
  })
);

export const KUBO_POLICIES = {
  UNIT_SPECIFICATION:
    'BR-017: Each kubo cottage represents an individual physical accommodation unit linked to a kubo type category.',
  STATUS_LIFECYCLE:
    'BR-021: Physical unit states control guest assignment and housekeeping readiness.',
  NO_DELETE_WITH_HISTORY:
    'BR-023: KUBOS WITH HISTORY CANNOT BE DELETED. Cottages with past or present bookings cannot be hard-deleted; mark Out of Service instead.',
  HOUSEKEEPING_READINESS:
    'Section 12: Vacated cottages placed in Cleaning must be inspected and marked Available before new check-ins.',
} as const;
