import type { UserRole } from '../types/auth.types';

/**
 * Canonical role names stored by the backend (BR-001). The database enforces
 * these exact lowercase values, so comparisons here are case-sensitive.
 */
export const ADMINISTRATOR_ROLE = 'administrator';
export const STAFF_ROLE = 'staff';

/** Whether a stored role name is the administrative role. */
export const isAdministratorRole = (roleName?: string | null): boolean =>
  roleName?.trim() === ADMINISTRATOR_ROLE;

/**
 * Maps a stored role name to the app's internal role.
 *
 * Throws for unsupported names instead of silently granting Staff access, so
 * a misconfigured account is blocked at sign-in with a clear message.
 */
export const toUserRole = (roleName: string): UserRole => {
  const name = roleName.trim();
  if (name === ADMINISTRATOR_ROLE) return 'Administrator';
  if (name === STAFF_ROLE) return 'Staff';
  throw new Error(`Unsupported role "${roleName}". Contact an administrator.`);
};

/** Human-readable label for a stored role name. */
export const formatRoleLabel = (roleName: string): string => {
  if (roleName === ADMINISTRATOR_ROLE) return 'Administrator';
  if (roleName === STAFF_ROLE) return 'Staff';
  return roleName;
};
