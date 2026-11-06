import type { KuboStatus } from '../types/kubo.types';

export const KUBO_STATUS_LABELS: Record<KuboStatus, string> = {
  Available: 'Available',
  Reserved: 'Reserved',
  Occupied: 'Occupied',
  Cleaning: 'Cleaning',
  Maintenance: 'Maintenance',
  UnderInspection: 'Under inspection',
  OutOfService: 'Out of service',
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
  UNIT_SPECIFICATION: 'Each kubo is one physical unit and belongs to one kubo type.',
  STATUS_LIFECYCLE: 'The status controls whether a kubo can take guests.',
  NO_DELETE_WITH_HISTORY:
    'Kubos with bookings can’t be deleted. Mark them out of service instead.',
  HOUSEKEEPING_READINESS: 'Kubos are marked for cleaning after check-out and become bookable once marked clean.',
} as const;
