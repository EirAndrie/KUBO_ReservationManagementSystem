import {
      createRole,
      getRoles,
      getRoleById,
      getRoleByName,
      updateRole,
      deleteRole,
} from "./repository/role.repository";
import { AppError } from "../../utils/http";
import type { CreateRoleDTO, UpdateRoleDTO } from "./repository/role.schema";

// Checked
export const createRoleService = async (
      data: CreateRoleDTO,
      actorEmployeeId: string,
) => {
      const existingRole = await getRoleByName(data.roleName);
      if (existingRole) {
            throw new AppError(400, "Role already exists");
      }

      return createRole(data, actorEmployeeId);
};

/** 
 * Checked: Searching functionality/query to be added in the future
 * - For MVP, this service will return all roles without any filtering or searching.
*/
export const getRolesService = async () => {
      const roles = await getRoles();

      if (!roles || roles.length === 0) {
            throw new AppError(404, "No roles found");
      }

      return roles;
};

// Checked
export const getRoleByIdService = async (roleId: string) => {
      const role = await getRoleById(roleId);
      if (!role) {
            throw new AppError(404, "Role not found");
      }

      return role;
};

// Checked
export const updateRoleService = async (
      roleId: string,
      data: UpdateRoleDTO,
      actorEmployeeId: string,
) => {
      const role = await getRoleById(roleId);
      if (!role) {
            throw new AppError(404, "Role not found");
      }

      return updateRole(roleId, data, actorEmployeeId);
};

// Checked
export const deleteRoleService = async (
      roleId: string,
      actorEmployeeId: string,
) => {
      const role = await getRoleById(roleId);
      if (!role) {
            throw new AppError(404, "Role not found");
      }

      await deleteRole(roleId, actorEmployeeId);
};
