import type {
      CreateEmployeeDTO,
      UpdateEmployeeDTO,
      EmployeeFilterDTO,
      EmployeeResponseDTO,
} from "./employee.schema";
import { db } from "../../../config/connectDB";
import { AppError, mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

// Checked
export const createEmployee = async (
      data: CreateEmployeeDTO,
): Promise<EmployeeResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_employee_management.create_employee($1, $2, $3, $4, $5, $6)
                  `,
                  [
                        data.roleId,
                        data.firstName,
                        data.lastName,
                        data.username,
                        data.passwordHash,
                        data.status,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert employee into database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to insert employee into database",
            );
      }
};

/**
 * Lists employees with optional role, status and search filters.
 *
 * `p_role` accepts either a role UUID or a role name. Search matches first
 * name, last name or username. Deleted/historical employees are not modelled
 * here; the database function only reads `kubo.employee`.
 */
export const getEmployees = async (
      params: EmployeeFilterDTO & {
            pagination: { limit: number; offset: number };
      },
): Promise<EmployeeResponseDTO[]> => {
      const { role, status, search, pagination } = params;
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_employee_management.get_employees(
                        p_role => $1,
                        p_status => $2::kubo.role_status,
                        p_search => $3,
                        p_limit => $4,
                        p_offset => $5
                  )
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

// Checked
export const getEmployeeById = async (
      employeeId: string,
): Promise<EmployeeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT * FROM kubo_employee_management.get_employee_by_id($1)
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

// Checked
export const getEmployeeByUsername = async (
      username: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `SELECT kubo_employee_management.check_username_exists($1) AS exists`,
                  [username]
            );

            return result.rows[0].exists as boolean;
      } catch (error: any) {
            logger.error("Failed to get employee by username from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to get employee by username from database");
      }
}

// Checked
export const updateEmployee = async (
      employeeId: string,
      data: UpdateEmployeeDTO,
): Promise<EmployeeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_employee_management.update_employee_role_status(
                        p_employee_id => $1,
                        p_role_id => $2,
                        p_first_name => $3,
                        p_last_name => $4,
                        p_username => $5,
                        p_status => $6
                  )
                  `,
                  [
                        employeeId,
                        data.roleId ?? null,
                        data.firstName ?? null,
                        data.lastName ?? null,
                        data.username ?? null,
                        data.status ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update employee in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to update employee in database");
      }
};

// Checked
export const deleteEmployee = async (employeeId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_employee_management.delete_unused_employee($1) AS deleted
                  `,
                  [employeeId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete employee from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to delete employee from database");
      }
};

/**
 * Resets an employee password using a pre-hashed bcrypt value.
 *
 * The database routine never returns `password_hash`; the caller receives the
 * safe employee profile instead.
 */
export const resetEmployeePassword = async (
      employeeId: string,
      passwordHash: string,
): Promise<EmployeeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_employee_management.reset_employee_password($1, $2)
                  `,
                  [employeeId, passwordHash],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to reset employee password in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to reset employee password in database",
            );
      }
};

