import {
      getAllRoles,
      getRoleById,
      createRole,
      updateRole,
      deleteRole,
      Role,
      NewRole,
} from "./repositories/role.queries";
import { roleRelations } from "./repositories/role.relations";
import { Pagination } from "../../utils/pagination";
import { getPaginationMeta } from "../../utils/pagination";

// Service layer – thin wrappers around query functions (and relationships)

export const getAllRolesService = async (
      pagination?: Pagination,
): Promise<{ data: Role[]; meta?: any }> => {
      // Basic pagination support – if pagination is provided, limit/offset can be applied in DB.
      // Current implementation returns all roles and derives meta using total count.
      const data = await getAllRoles();
      if (pagination) {
            const total = data.length; // Placeholder; replace with actual count query when needed.
            const meta = getPaginationMeta(pagination, total);
            return { data, meta };
      }
      return { data };
};

export const getRoleByIdService = async (
      roleId: string,
): Promise<Role | undefined> => {
      return await getRoleById(roleId);
};

export const createRoleService = async (data: NewRole): Promise<Role> => {
      return await createRole(data);
};

export const updateRoleService = async (
      roleId: string,
      data: Partial<NewRole>,
): Promise<Role | undefined> => {
      return await updateRole(roleId, data);
};

export const deleteRoleService = async (roleId: string): Promise<void> => {
      await deleteRole(roleId);
};

// Relationship helper – fetch employees for a role (currently stub)
export const getEmployeesByRoleService = async (
      roleId: string,
): Promise<any[]> => {
      return await roleRelations.getEmployeesByRoleId(roleId);
};
