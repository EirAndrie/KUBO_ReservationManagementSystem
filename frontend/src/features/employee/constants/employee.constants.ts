import type { EmployeeStatus } from '../types/employee.types';

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  Active: 'Active',
  Inactive: 'Inactive',
  Suspended: 'Suspended',
  OnLeave: 'On leave',
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
  ONE_ROLE: 'Each employee has exactly one role.',
  CREDENTIALS: 'Passwords are 6 to 12 characters.',
  ACTIVE_STATUS: 'Only active employees can sign in.',
  LAST_ADMIN_PROTECTION:
    'There must always be at least one active administrator. The last one can’t be demoted, suspended or deleted.',
  NO_DELETE_WITH_REFERENCES:
    'Accounts with recorded work (reservations, payments, audit entries) can’t be deleted. Suspend access instead.',
  ROLE_PROTECTION: 'Roles assigned to employees can’t be deleted. Reassign those employees first.',
} as const;
