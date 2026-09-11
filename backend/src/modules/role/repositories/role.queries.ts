// Role Queries using Drizzle ORM
// Provides basic CRUD operations for the Role entity.

import { db } from "../../../config/connectDB";
import { eq } from "drizzle-orm";
import { role } from "./role.model";

// Type definitions for Role records using Drizzle inference
export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;

// Get all roles
export const getAllRoles = async (): Promise<Role[]> => {
      return await db.select().from(role);
};

// Get a role by its ID
export const getRoleById = async (
      roleId: string,
): Promise<Role | undefined> => {
      const result = await db
            .select()
            .from(role)
            .where(eq(role.roleId, roleId))
            .limit(1);
      return result[0];
};

// Create a new role
export const createRole = async (data: NewRole): Promise<Role> => {
      const [created] = await db.insert(role).values(data).returning();
      return created;
};

// Update an existing role
export const updateRole = async (
      roleId: string,
      data: Partial<NewRole>,
): Promise<Role | undefined> => {
      const result = await db
            .update(role)
            .set(data)
            .where(eq(role.roleId, roleId))
            .returning();
      return result[0];
};

// Delete a role
export const deleteRole = async (roleId: string): Promise<void> => {
      await db.delete(role).where(eq(role.roleId, roleId));
};
