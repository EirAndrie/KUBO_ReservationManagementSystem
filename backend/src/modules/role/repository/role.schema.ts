import { z } from "zod";

export const RoleSchema = z.object({
      roleId: z.string().uuid(),
      roleName: z.string().nonempty({ message: "Role name is required." }), // replaces required_error
      description: z
            .string()
            .nonempty({ message: "Role description is required" }),
});

// Schema and DTO for creating
export const CreateRoleSchema = RoleSchema.omit({ roleId: true });
export type CreateRoleDTO = z.infer<typeof CreateRoleSchema>;

// Schema and DTO for updating
export const UpdateRoleSchema = RoleSchema.pick({ roleId: true }).merge(
      RoleSchema.omit({ roleId: true }).partial(),
);
export type UpdateRoleDTO = z.infer<typeof UpdateRoleSchema>;

// Reponse DTO
export type RoleResponseDTO = z.infer<typeof RoleSchema>;
