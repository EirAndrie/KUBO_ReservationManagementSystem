import {
      createRole,
      getRoles,
      getRoleById,
      getRoleByName,
      updateRole,
      deleteRole,
} from "./repository/role.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type { CreateRoleDTO, UpdateRoleDTO } from "./repository/role.schema";

export const createRoleService = async (data: CreateRoleDTO) => {
      const existingRole = await getRoleByName(data.roleName);
      if (existingRole) {
            throw new AppError(400, "Role already exists");
      }

      return createRole(data);
};

export const getRolesService = async () => {
      return getRoles();
};

export const getRoleByIdService = async (roleId: string) => {
      const role = await getRoleById(roleId);
      if (!role) {
            throw new AppError(404, "Role not found");
      }

      return role;
};

export const updateRoleService = async (data: UpdateRoleDTO) => {
      const role = await getRoleById(data.roleId);
      if (!role) {
            throw new AppError(404, "Role not found");
      }

      return updateRole(data);
};

export const deleteRoleService = async (roleId: string) => {
      const role = await getRoleById(roleId);
      if (!role) {
            throw new AppError(404, "Role not found");
      }

      await deleteRole(roleId);
};
