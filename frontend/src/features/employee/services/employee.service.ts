import { apiClient } from '@/lib/api';
import type {
  Employee,
  Role,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  CreateRolePayload,
  UpdateRolePayload,
  EmployeeFilterParams,
  EmployeeStatus,
} from '../types/employee.types';

function normalizeStatus(val?: string): EmployeeStatus {
  const lower = (val || '').toLowerCase().replace(/\s+/g, '');
  if (lower.includes('terminat')) return 'Terminated';
  if (lower.includes('suspend')) return 'Suspended';
  if (lower.includes('onleave') || lower.includes('leave')) return 'OnLeave';
  if (lower.includes('inact')) return 'Inactive';
  return 'Active';
}

function mapEmployeeRecord(row: Record<string, unknown>): Employee {
  const firstName = String(row.first_name || row.firstName || '');
  const lastName = String(row.last_name || row.lastName || '');
  return {
    employeeId: String(row.employee_id || row.employeeId || ''),
    roleId: String(row.role_id || row.roleId || ''),
    roleName: row.role_name ? String(row.role_name) : row.role ? String(row.role) : undefined,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim() || String(row.username || 'Employee'),
    username: String(row.username || ''),
    status: normalizeStatus(String(row.status || 'Active')),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    referencingCount: typeof row.referencing_count === 'number' ? row.referencing_count : undefined,
  };
}

function mapRoleRecord(row: Record<string, unknown>): Role {
  return {
    roleId: String(row.role_id || row.roleId || ''),
    roleName: String(row.role_name || row.roleName || ''),
    description: String(row.description || ''),
  };
}

export const employeeService = {
  /**
   * Fetches all registered employees with optional search and filters.
   */
  getAllEmployees: async (filters?: EmployeeFilterParams): Promise<Employee[]> => {
    const params: Record<string, string | undefined> = {};
    if (filters?.role) params.role = filters.role;
    if (filters?.status) params.status = filters.status;
    if (filters?.search?.trim()) params.search = filters.search.trim();

    const res = await apiClient.get<Record<string, unknown>>('/employees', { params });
    const raw = res as unknown as { employees?: Record<string, unknown>[] } | Record<string, unknown>[];
    if (Array.isArray(raw)) return raw.map(mapEmployeeRecord);
    if (Array.isArray((raw as { employees?: Record<string, unknown>[] })?.employees)) {
      return (raw as { employees: Record<string, unknown>[] }).employees.map(mapEmployeeRecord);
    }
    throw new Error('The server returned an invalid employee list.');
  },

  /**
   * Fetches an individual employee by UUID.
   */
  getEmployeeById: async (employeeId: string): Promise<Employee> => {
    const res = await apiClient.get<Record<string, unknown>>(`/employees/${employeeId}`);
    const raw = res as unknown as { employees?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { employees?: Record<string, unknown> })?.employees || raw;
    if (!row || typeof row !== 'object') throw new Error('The server returned an invalid employee record.');
    return mapEmployeeRecord(row as Record<string, unknown>);
  },

  /**
   * Registers a new employee account (BR-002, BR-003).
   */
  createEmployee: async (payload: CreateEmployeePayload): Promise<Employee> => {
    const backendData = {
      roleId: payload.roleId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username.trim(),
      passwordHash: payload.password,
      status: payload.status || 'Active',
    };

    const res = await apiClient.post<Record<string, unknown>>('/employees', backendData);
    const raw = res as unknown as { employees?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { employees?: Record<string, unknown> })?.employees || raw;
    return mapEmployeeRecord(row as Record<string, unknown>);
  },

  /**
   * Updates an employee profile (BR-002).
   */
  updateEmployee: async (
    employeeId: string,
    payload: UpdateEmployeePayload
  ): Promise<Employee> => {
    const backendData = {
      roleId: payload.roleId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      status: payload.status,
    };

    const res = await apiClient.patch<Record<string, unknown>>(
      `/employees/${employeeId}`,
      backendData
    );
    const raw = res as unknown as { employees?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { employees?: Record<string, unknown> })?.employees || raw;
    return mapEmployeeRecord(row as Record<string, unknown>);
  },

  /**
   * Resets an employee password with policy validation (BR-003: 6-12 chars).
   */
  resetPassword: async (employeeId: string, password: string): Promise<void> => {
    await apiClient.patch(`/employees/${employeeId}/password`, { password });
  },

  /**
   * Deletes an employee account if no transaction history exists (BR-007, BR-072).
   */
  deleteEmployee: async (employeeId: string): Promise<void> => {
    await apiClient.delete(`/employees/${employeeId}`);
  },

  /**
   * Lists all operational roles (BR-001).
   */
  getAllRoles: async (): Promise<Role[]> => {
    const res = await apiClient.get<Record<string, unknown>>('/roles');
    const raw = res as unknown as { roles?: Record<string, unknown>[] } | Record<string, unknown>[];
    if (Array.isArray(raw)) return raw.map(mapRoleRecord);
    if (Array.isArray((raw as { roles?: Record<string, unknown>[] })?.roles)) {
      return (raw as { roles: Record<string, unknown>[] }).roles.map(mapRoleRecord);
    }
    throw new Error('The server returned an invalid role list.');
  },

  /**
   * Creates a new role (BR-008).
   */
  createRole: async (payload: CreateRolePayload): Promise<Role> => {
    const res = await apiClient.post<Record<string, unknown>>('/roles', payload);
    const raw = res as unknown as { roles?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { roles?: Record<string, unknown> })?.roles || raw;
    return mapRoleRecord(row as Record<string, unknown>);
  },

  /**
   * Updates an existing role name or description.
   */
  updateRole: async (roleId: string, payload: UpdateRolePayload): Promise<Role> => {
    const res = await apiClient.patch<Record<string, unknown>>(`/roles/${roleId}`, payload);
    const raw = res as unknown as { roles?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { roles?: Record<string, unknown> })?.roles || raw;
    return mapRoleRecord(row as Record<string, unknown>);
  },

  /**
   * Deletes a role if no active personnel are assigned to it (BR-008, BR-072).
   */
  deleteRole: async (roleId: string): Promise<void> => {
    await apiClient.delete(`/roles/${roleId}`);
  },
};
