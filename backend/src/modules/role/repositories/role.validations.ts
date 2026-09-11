// Role Validations using Zod
// Defines schemas for validating role creation and update payloads.
import { z } from "zod";
import { ROLES } from "./role.model";

export const roleCreateSchema = z.object({
      roleName: z.string().refine((val) => ROLES.includes(val as any), {
            message: `Invalid role name, must be one of: ${ROLES.join(", ")}`,
      }),
      roleDescription: z
            .string()
            .max(255, {
                  message: "Role description must be at most 255 characters",
            })
            .optional(),
});

// For updates we allow partial fields but still enforce the same constraints.

export const roleUpdateSchema = roleCreateSchema.partial();

export type RoleCreateDTO = z.infer<typeof roleCreateSchema>;
export type RoleUpdateDTO = z.infer<typeof roleUpdateSchema>;
