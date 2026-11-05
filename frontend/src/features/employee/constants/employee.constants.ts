import type { EmployeeStatus } from '../types/employee.types';

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  Active: 'Active',
  Inactive: 'Inactive',
  Suspended: 'Suspended',
  OnLeave: 'On Leave',
  Terminated: 'Terminated',
};

export const EMPLOYEE_STATUS_TAGS: Record<EmployeeStatus, { color: string }> = {
  Active: { color: 'success' },
  Inactive: { color: 'default' },
  Suspended: { color: 'error' },
  OnLeave: { color: 'warning' },
  Terminated: { color: '#64748b' },
};

export const EMPLOYEE_STATUS_OPTIONS = Object.entries(EMPLOYEE_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as EmployeeStatus,
    label,
  })
);

export const EMPLOYEE_POLICIES = {
  ONE_ROLE:
    'BR-001: Every employee record references exactly one operational role (Administrator or Staff).',
  CREDENTIALS:
    'BR-003: Passwords must be 6-12 characters long with alphanumeric composition. Passwords are never returned in plaintext.',
  ACTIVE_STATUS:
    'BR-004: Only Active employees can sign in and execute resort transactions. Inactive, suspended, or terminated personnel are denied.',
  LAST_ADMIN_PROTECTION:
    'BR-006, BR-080: AT LEAST ONE ACTIVE ADMINISTRATOR required. The last active Administrator cannot be demoted or disabled.',
  NO_DELETE_WITH_REFERENCES:
    'BR-007, BR-072: CANNOT DELETE ACCOUNT WITH REFERENCES. Accounts linked to reservations, payments, charges, or audits cannot be deleted; set status to Terminated instead.',
  ROLE_PROTECTION:
    'BR-008: Roles referenced by employees cannot be deleted. Reassign employees before removing a role.',
} as const;
