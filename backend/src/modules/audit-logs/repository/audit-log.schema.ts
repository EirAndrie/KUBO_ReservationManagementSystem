import { z } from "zod";

const ACTION_ENUM = [
      "create",
      "update",
      "delete",
      "login",
      "logout",
      "cancel",
      "approve",
      "reject",
] as const;

export const AuditLogSchema = z.object({
      // PKs & FKs
      auditLogId: z.string().uuid(),
      employeeId: z.string().uuid({
            message: "Invalid Employee ID format, must be UUID to reference",
      }),

      // Audit log details
      auditAction: z.enum(ACTION_ENUM, {
            message: "Invalid audit action entry, must follow system integrated status enums",
      }),
      entityId: z.string({
            message: "Must include the id of the entity being performed at",
      }),
      auditDescription: z.string({
            message: "Audit description is required for history records",
      }),

      // JSON values
      oldValues: z.object({}).catchall(z.any()).nullable().default(null),
      newValues: z.object({}).catchall(z.any()).nullable().default(null),

      // Date when the audit was triggered
      dateTime: z.date(),
});

// Schema and DTO for creating
export const CreateAuditLogSchema = AuditLogSchema.omit({ auditLogId: true });
export type CreateAuditLogDTO = z.infer<typeof CreateAuditLogSchema>;

// Schema and DTO for updating
export const UpdateAuditLogSchema = AuditLogSchema.pick({
      auditLogId: true,
}).merge(AuditLogSchema.omit({ auditLogId: true }).partial());
export type UpdateAuditLogDTO = z.infer<typeof UpdateAuditLogSchema>;

// Response DTO
export type AuditLogResponseDTO = z.infer<typeof AuditLogSchema>;
