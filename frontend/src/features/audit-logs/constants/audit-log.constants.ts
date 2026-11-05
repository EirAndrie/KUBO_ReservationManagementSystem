import type { AuditAction } from '../types/audit-log.types';

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  login: 'Sign In',
  logout: 'Sign Out',
  cancel: 'Cancellation',
  approve: 'Approval',
  reject: 'Rejection',
};

export const AUDIT_ACTION_TAGS: Record<AuditAction, { color: string }> = {
  create: { color: 'green' },
  update: { color: 'blue' },
  delete: { color: 'red' },
  login: { color: 'cyan' },
  logout: { color: 'default' },
  cancel: { color: 'volcano' },
  approve: { color: 'blue' },
  reject: { color: 'red' },
};

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(
  ([value, label]) => ({
    value: value as AuditAction,
    label,
  })
);

export const AUDIT_POLICIES = {
  MANDATORY_EVENTS:
    'BR-067: At minimum, audits reservation creation, confirmation, check-in, check-out, cancellations, rate modifications, payments, and staff status changes.',
  IMMUTABILITY:
    'BR-069: The audit log is strictly immutable and append-only. No modifications or deletions are permitted under any role.',
  SENSITIVE_DATA_EXCLUSION:
    'BR-070: Plaintext passwords and cryptographic hashes are strictly prohibited from audit descriptions, old values, and new values.',
  ADMIN_READ_ONLY:
    'BR-078, BR-082: Administrator audit log review is strictly read-only. Administrators verify compliance without modifying historical records.',
} as const;
