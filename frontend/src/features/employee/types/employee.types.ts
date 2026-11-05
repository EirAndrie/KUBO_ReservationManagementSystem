/**
 * Domain types and DTO contracts for the Employee and Role Management module.
 * Implements Business Rules BR-001 through BR-008, BR-072, and BR-080.
 */

export const EMPLOYEE_STATUSES = [
  'Active',
  'Inactive',
  'Suspended',
  'OnLeave',
  'Terminated',
] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export interface Role {
  roleId: string;
  roleName: string;
  description: string;
}

export interface Employee {
  employeeId: string;
  roleId: string;
  roleName?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  status: EmployeeStatus;
  createdAt?: string;
  referencingCount?: number;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  roleId: string;
  status?: EmployeeStatus;
}

export interface UpdateEmployeePayload {
  firstName?: string;
  lastName?: string;
  roleId?: string;
  status?: EmployeeStatus;
}

export interface ResetPasswordPayload {
  password: string;
}

export interface CreateRolePayload {
  roleName: string;
  description: string;
}

export interface UpdateRolePayload {
  roleName?: string;
  description?: string;
}

export interface EmployeeFilterParams {
  role?: string;
  status?: EmployeeStatus;
  search?: string;
}
