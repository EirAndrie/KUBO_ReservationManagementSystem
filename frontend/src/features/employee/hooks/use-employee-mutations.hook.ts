import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { employeeService } from '../services/employee.service';
import { employeeKeys } from './use-employees.hook';
import type {
  Employee,
  Role,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  CreateRolePayload,
  UpdateRolePayload,
} from '../types/employee.types';

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useAppMutation<Employee, CreateEmployeePayload>({
    mutationFn: (payload) => employeeService.createEmployee(payload),
    successMessage: 'Employee added.',
    errorMessage: (error) => error.message || 'Failed to create employee.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useAppMutation<Employee, { employeeId: string; payload: UpdateEmployeePayload }>({
    mutationFn: ({ employeeId, payload }) => employeeService.updateEmployee(employeeId, payload),
    successMessage: 'Employee updated.',
    errorMessage: (error) => error.message || 'Failed to update employee.',
    onSuccess: (_data, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(employeeId) });
    },
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();

  return useAppMutation<void, { employeeId: string; password: string }>({
    mutationFn: ({ employeeId, password }) => employeeService.resetPassword(employeeId, password),
    successMessage: 'Password reset.',
    errorMessage: (error) => error.message || 'Failed to reset password.',
    onSuccess: (_data, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(employeeId) });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useAppMutation<void, string>({
    mutationFn: (employeeId) => employeeService.deleteEmployee(employeeId),
    successMessage: 'Employee deleted.',
    errorMessage: (error) => {
      if (error.message?.includes('violates foreign key') || error.message?.includes('reference')) {
        return 'This account has recorded work, so it can’t be deleted. Suspend access instead.';
      }
      return error.message || 'Failed to delete employee account.';
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useAppMutation<Role, CreateRolePayload>({
    mutationFn: (payload) => employeeService.createRole(payload),
    successMessage: 'Role created.',
    errorMessage: (error) => error.message || 'Failed to create role.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.roles });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useAppMutation<Role, { roleId: string; payload: UpdateRolePayload }>({
    mutationFn: ({ roleId, payload }) => employeeService.updateRole(roleId, payload),
    successMessage: 'Role updated.',
    errorMessage: (error) => error.message || 'Failed to update role.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.roles });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useAppMutation<void, string>({
    mutationFn: (roleId) => employeeService.deleteRole(roleId),
    successMessage: 'Role deleted.',
    errorMessage: (error) => {
      if (error.message?.includes('reference') || error.message?.includes('foreign key')) {
        return 'This role is assigned to employees. Reassign them first.';
      }
      return error.message || 'Failed to delete role.';
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.roles });
    },
  });
}
