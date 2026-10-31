import { z } from "zod";

export const RoleSchema = z.object({
      roleId: z.string().uuid(),
      roleName: z
            .string()
            .trim()
            .min(1, { message: "Role name is required." })
            .max(50, { message: "Role name cannot exceed 50 characters." }),
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
