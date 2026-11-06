/**
 * Public barrel export for the Employee and Role Management module.
 * Direct access to internal paths from outside this module is prohibited.
 */

// Pages
export { EmployeeListPage } from './pages/employee-list.page';

// Components
export { EmployeeFormModal } from './components/employee-form-modal.component';
export type { EmployeeFormModalProps } from './components/employee-form-modal.component';

export { ResetPasswordModal } from './components/reset-password-modal.component';
export type { ResetPasswordModalProps } from './components/reset-password-modal.component';

// Hooks
export {
  useEmployees,
  useEmployee,
  useRoles,
  employeeKeys,
} from './hooks/use-employees.hook';

export {
  useCreateEmployee,
  useUpdateEmployee,
  useResetPassword,
  useDeleteEmployee,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from './hooks/use-employee-mutations.hook';

// Services
export { employeeService } from './services/employee.service';

// Types
export type {
  Employee,
  Role,
  EmployeeStatus,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  ResetPasswordPayload,
  CreateRolePayload,
  UpdateRolePayload,
  EmployeeFilterParams,
} from './types/employee.types';

export { EMPLOYEE_STATUSES } from './types/employee.types';

// Constants
export {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TAGS,
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYEE_POLICIES,
} from './constants/employee.constants';
