import type {
      CreateEmployeeDTO,
      UpdateEmployeeDTO,
      EmployeeResponseDTO,
} from "./employee.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createEmployee = async (
      data: CreateEmployeeDTO,
): Promise<EmployeeResponseDTO> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.create_employee(
                              $1, $2, $3, $4, $5, $6, $7
                        )
                  `,
                  [
                        data.roleId,
                        data.firstName,
                        data.lastName,
                        data.username,
                        data.passwordHash,
                        data.status,
                        // any additional fields? none
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert employee into database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to insert employee into database");
      }
};

export const getEmployees = async (): Promise<EmployeeResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_employees()
                  `,
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch employees from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to fetch employees from database");
      }
};

export const getEmployeeById = async (
      employeeId: string,
): Promise<EmployeeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_employee_by_id($1)
                  `,
                  [employeeId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get employee by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(
                  500,
                  "Failed to get employee by id from database",
            );
      }
};

export const updateEmployee = async (
      data: UpdateEmployeeDTO,
): Promise<EmployeeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_employee(
                              $1, $2, $3, $4, $5, $6, $7
                        )
                  `,
                  [
                        data.employeeId,
                        data.roleId ?? null,
                        data.firstName ?? null,
                        data.lastName ?? null,
                        data.username ?? null,
                        data.passwordHash ?? null,
                        data.status ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update employee in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to update employee in database");
      }
};

export const deleteEmployee = async (employeeId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT kubo.delete_employee($1) AS deleted
                  `,
                  [employeeId],
            );
            return result.rows[0]?.deleted != null;
      } catch (error: any) {
            logger.error("Failed to delete employee from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to delete employee from database");
      }
};

export const searchEmployees = async (params: {
      role?: string;
      status?: string;
      search?: string;
      pagination: { limit: number; offset: number };
}): Promise<EmployeeResponseDTO[]> => {
      const { role, status, search, pagination } = params;
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_employees($1, $2, $3, $4, $5)
                  `,
                  [
                        role ?? null,
                        status ?? null,
                        search ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search employees in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to search employees in database");
      }
};
