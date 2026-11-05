import { useQuery } from '@tanstack/react-query';
import { employeeService } from '../services/employee.service';
import type { Employee, Role, EmployeeFilterParams } from '../types/employee.types';

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (filters?: EmployeeFilterParams) => [...employeeKeys.lists(), filters ?? {}] as const,
  detail: (id: string) => [...employeeKeys.all, 'detail', id] as const,
  roles: ['roles'] as const,
};

/**
 * Hook to retrieve staff list with optional filters.
 */
export function useEmployees(filters?: EmployeeFilterParams) {
  return useQuery<Employee[], Error>({
    queryKey: employeeKeys.list(filters),
    queryFn: () => employeeService.getAllEmployees(filters),
    staleTime: 1000 * 30,
  });
}

/**
 * Hook to retrieve single employee by ID.
 */
export function useEmployee(employeeId: string) {
  return useQuery<Employee, Error>({
    queryKey: employeeKeys.detail(employeeId),
    queryFn: () => employeeService.getEmployeeById(employeeId),
    enabled: Boolean(employeeId),
  });
}

/**
 * Hook to retrieve all operational roles.
 */
export function useRoles() {
  return useQuery<Role[], Error>({
    queryKey: employeeKeys.roles,
    queryFn: () => employeeService.getAllRoles(),
    staleTime: 1000 * 60,
  });
}
