import type {
      LoginCredentials,
      AuthenticatedEmployee,
} from "./auth.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

/** Maps a raw credential row to the camelCase application shape. */
const toLoginCredentials = (row: any): LoginCredentials => ({
      employeeId: row.employee_id,
      roleId: row.role_id,
      roleName: row.role_name,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      status: row.status,
      passwordHash: row.password_hash,
});

/** Maps a raw employee row to the safe (hash-free) application shape. */
const toAuthenticatedEmployee = (row: any): AuthenticatedEmployee => ({
      employeeId: row.employee_id,
      roleId: row.role_id,
      roleName: row.role_name,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      status: row.status,
});

/**
 * Looks up an employee's login credentials (including the password hash) by
 * exact username match. Returns `null` when no employee has that username.
 */
export const getLoginCredentials = async (
      username: string,
): Promise<LoginCredentials | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_auth_management.get_login_credentials($1)
                  `,
                  [username],
            );
            return result.rows[0]
                  ? toLoginCredentials(result.rows[0])
                  : null;
      } catch (error: any) {
            logger.error("Failed to fetch login credentials", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to fetch login credentials",
            );
      }
};

/**
 * Fetches the current employee + role profile for an authenticated employee.
 * Used to refresh identity on every protected request and by `GET /auth/me`.
 */
export const getAuthenticatedEmployee = async (
      employeeId: string,
): Promise<AuthenticatedEmployee | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_auth_management.get_authenticated_employee($1)
                  `,
                  [employeeId],
            );
            return result.rows[0]
                  ? toAuthenticatedEmployee(result.rows[0])
                  : null;
      } catch (error: any) {
            logger.error("Failed to fetch authenticated employee", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to fetch authenticated employee",
            );
      }
};
