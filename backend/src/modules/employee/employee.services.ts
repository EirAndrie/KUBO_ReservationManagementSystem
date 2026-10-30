import {
      createEmployee,
      getEmployees,
      getEmployeeById,
      getEmployeeByUsername,
      updateEmployee,
      deleteEmployee,
} from "./repository/employee.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type {
      CreateEmployeeDTO,
      UpdateEmployeeDTO,
      EmployeeFilterDTO,
} from "./repository/employee.schema";
import type { Pagination } from "../../utils/pagination";
import bcrypt from "bcrypt";

// For password hashing
const SALT_ROUNDS = 12;

// Checked
export const createEmployeeService = async (data: CreateEmployeeDTO) => {
      const usernameExists = await getEmployeeByUsername(data.username);
      if (usernameExists) {
            throw new AppError(400, "Username already exists, try another username");
      }

      const hashedPassword = await bcrypt.hash(data.passwordHash, SALT_ROUNDS);
      return createEmployee({ ...data, passwordHash: hashedPassword });
};

// Checked
export const getAllEmployeesService = async (
      filters: EmployeeFilterDTO,
      pagination: Pagination,
) => {
      return getEmployees({
            role: filters.role,
            status: filters.status,
            search: filters.search,
            pagination: {
                  limit: pagination.limit,
                  offset: pagination.offset,
            },
      });
};

// Checked
export const getEmployeeByIdService = async (employeeId: string) => {
      const emp = await getEmployeeById(employeeId);
      if (!emp) {
            throw new AppError(404, "Employee not found");
      }
      return emp;
};

// Checked
export const updateEmployeeService = async (
      employeeId: string,
      data: UpdateEmployeeDTO,
) => {
      // Check employee existence
      const doesExist = await getEmployeeById(employeeId);
      if (!doesExist) {
            throw new AppError(404, "Employee not found");
      }

      // Check if username is being updated and if it already exists
      if (
            data.username !== undefined &&
            data.username !== doesExist.username
      ) {
            const usernameExists = await getEmployeeByUsername(data.username);
            if (usernameExists) {
                  throw new AppError(
                        400,
                        "Username already exists, try another username",
                  );
            }
      }

      return updateEmployee(employeeId, data);
};

// Checked
export const deleteEmployeeService = async (employeeId: string) => {
      const existing = await getEmployeeById(employeeId);
      if (!existing) {
            throw new AppError(404, "Employee not found");
      }
      await deleteEmployee(employeeId);
};
