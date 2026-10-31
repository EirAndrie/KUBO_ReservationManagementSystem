import type {
      CreateRoleDTO,
      RoleResponseDTO,
      UpdateRoleDTO,
} from "./role.schema";
import { db } from "../../../config/connectDB";
import { AppError, mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createRole = async (
      data: CreateRoleDTO,
): Promise<RoleResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_role_management.create_role($1, $2)
                  `,
                  [data.roleName, data.description],
            );

            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert role to database", {
                  message: error.message,
                  stack: error.stack,
            });

            throw mapDatabaseError(error, "Failed to insert Role to database");
      }
};

export const getRoles = async (): Promise<RoleResponseDTO[]> => {
      try {
            const result = await db.query(
                  `SELECT * FROM kubo_role_management.get_roles()`
            );

            return result.rows;
      } catch (error: any) {
            logger.error("Failed to list roles from database", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(500, "Failed to list Roles from database");
      }
};

export const getRoleById = async (
      roleId: string,
): Promise<RoleResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_role_management.get_role_by_id($1)
                  `,
                  [roleId],
            );

            const role = result.rows[0];
            return role?.role_id == null ? null : role;
      } catch (error: any) {
            logger.error("Failed to get role by id from database", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(500, "Failed to get Role by id from database");
      }
};

export const getRoleByName = async (
      roleName: string,
): Promise<RoleResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_role_management.get_role_by_name($1)
                  `,
                  [roleName],
            );

            const role = result.rows[0];
            return role?.role_id == null ? null : role;
      } catch (error: any) {
            logger.error("Failed to get role by name from database", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(500, "Failed to get Role by name from database");
      }
};

export const updateRole = async (
      roleId: string,
      data: UpdateRoleDTO,
): Promise<RoleResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_role_management.update_role($1, $2, $3)
                  `,
                  [
                        roleId,
                        data.roleName ?? null,
                        data.description ?? null,
                  ],
            );

            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update role to database", {
                  message: error.message,
                  stack: error.stack,
            });

            throw mapDatabaseError(error, "Failed to update Role to database");
      }
};

export const deleteRole = async (roleId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_role_management.delete_unused_role($1) AS deleted
                  `,
                  [roleId],
            );

            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete role from database", {
                  message: error.message,
                  stack: error.stack,
            });

            throw mapDatabaseError(error, "Failed to delete Role from database");
      }
};
