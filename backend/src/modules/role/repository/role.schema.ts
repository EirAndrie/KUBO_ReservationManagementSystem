import { z } from "zod";
import { ROLE_NAMES } from "../../../utils/role-names";

/**
 * Role names are stored in their canonical lowercase form. Input is trimmed
 * and lowercased so `Administrator` is accepted, but only the full business
 * names are valid — shorthand such as `admin` is rejected (BR-001, BR-008).
 */
const roleNameSchema = z
      .string()
      .trim()
      .min(1, { message: "Role name is required." })
      .max(50, { message: "Role name cannot exceed 50 characters." })
      .transform((value) => value.toLowerCase())
      .refine((value) => (ROLE_NAMES as readonly string[]).includes(value), {
            message: "Role name must be 'administrator' or 'staff'.",
      });

export const RoleSchema = z.object({
      roleId: z.string().uuid(),
      roleName: roleNameSchema,
      description: z
            .string()
            .trim()
            .min(1, { message: "Role description is required" })
            .max(255, { message: "Role description cannot exceed 255 characters." }),
});

// Schema and DTO for creating
export const CreateRoleSchema = RoleSchema.omit({ roleId: true });
export type CreateRoleDTO = z.infer<typeof CreateRoleSchema>;

// Schema and DTO for updating
export const UpdateRoleSchema = RoleSchema.omit({ roleId: true }).partial();
export type UpdateRoleDTO = z.infer<typeof UpdateRoleSchema>;

// Reponse DTO
export type RoleResponseDTO = z.infer<typeof RoleSchema>;
