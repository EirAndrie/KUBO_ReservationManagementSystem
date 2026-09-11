// Role Validations using Zod
// Defines schemas for validating role creation and update payloads.
import { z } from "zod";
import { ROLES } from "./role.model";

export const roleCreateSchema = z.object({
      roleName: z.enum(ROLES),
      roleDescription: z.string().max(255).optional(),
});

// For updates we allow partial fields but still enforce the same constraints.
export const roleUpdateSchema = roleCreateSchema.partial();
