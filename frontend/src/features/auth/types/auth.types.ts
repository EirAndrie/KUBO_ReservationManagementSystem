/**
 * Types and DTOs for the Authentication feature module.
 * Strictly adheres to BR-001 (Single Role), BR-003 (Credentials), and BR-004 (Active Status).
 */

export type UserRole = 'Administrator' | 'Staff';

export type EmployeeStatus =
  | 'Active'
  | 'Inactive'
  | 'Suspended'
  | 'OnLeave'
  | 'Terminated';

export interface AuthUser {
  employeeId: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  status: EmployeeStatus;
  token: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  user: AuthUser;
}
