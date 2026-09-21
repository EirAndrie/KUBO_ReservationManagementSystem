import {
      createEmployee,
      getEmployees,
      getEmployeeById,
      updateEmployee,
      deleteEmployee,
      searchEmployees,
} from "./repository/employee.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type {
      CreateEmployeeDTO,
      UpdateEmployeeDTO,
} from "./repository/employee.schema";
import type { Pagination } from "../../utils/pagination";

export const createEmployeeService = async (data: CreateEmployeeDTO) => {
      // No uniqueness checks defined in spec
      return createEmployee(data);
};

export const getAllEmployeesService = async () => {
      return getEmployees();
};

export const getEmployeeByIdService = async (employeeId: string) => {
      const emp = await getEmployeeById(employeeId);
      if (!emp) {
            throw new AppError(404, "Employee not found");
      }
      return emp;
};

export const updateEmployeeService = async (data: UpdateEmployeeDTO) => {
      const existing = await getEmployeeById(data.employeeId);
      if (!existing) {
            throw new AppError(404, "Employee not found");
      }
      return updateEmployee(data);
};

export const deleteEmployeeService = async (employeeId: string) => {
      const existing = await getEmployeeById(employeeId);
      if (!existing) {
            throw new AppError(404, "Employee not found");
      }
      await deleteEmployee(employeeId);
};

export const searchEmployeesService = async (params: {
      role?: string;
      status?: string;
      search?: string;
      pagination: Pagination;
}) => {
      return searchEmployees({
            role: params.role,
            status: params.status,
            search: params.search,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};
