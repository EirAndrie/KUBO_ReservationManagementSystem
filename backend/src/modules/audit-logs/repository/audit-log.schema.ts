import { z } from "zod";

/**
 * Audit actions understood by the audit log, matching the `kubo.audit_action`
 * enum. Input is normalized to this casing before validation.
 */
export const AUDIT_ACTIONS = [
      "Create",
      "Update",
      "Delete",
      "Login",
      "Logout",
      "Cancel",
      "Approve",
      "Reject",
] as const;

export const AuditActionSchema = z.enum(AUDIT_ACTIONS, {
      message: "Invalid audit action",
});

const optionalUuid = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.string().uuid().optional(),
);

const optionalText = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.string().trim().min(1).max(255).optional(),
);

const optionalDateTime = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.coerce.date().optional(),
);

const normalizeAction = (value: unknown) => {
      if (typeof value !== "string") {
            return value;
      }
      const trimmed = value.trim();
      if (trimmed === "") {
            return undefined;
      }
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

export const AuditLogFilterSchema = z
      .object({
            employeeId: optionalUuid,
            action: z.preprocess(normalizeAction, AuditActionSchema.optional()),
            entityType: optionalText,
            entityId: optionalUuid,
            createdFrom: optionalDateTime,
            createdTo: optionalDateTime,
      })
      .refine(
            (value) =>
                  value.createdFrom === undefined ||
                  value.createdTo === undefined ||
                  value.createdTo >= value.createdFrom,
            {
                  message: "createdTo must not be earlier than createdFrom",
                  path: ["createdTo"],
            },
      );

export type AuditLogFilterDTO = z.infer<typeof AuditLogFilterSchema>;

/**
 * Payload for the application-level audit writer, used for events (login and
 * logout) that have no database mutation routine to write the row themselves.
 */
export type WriteAuditLogParams = {
      employeeId: string;
      action: (typeof AUDIT_ACTIONS)[number];
      entityType: string;
      entityId: string;
      description?: string | null;
      oldValues?: Record<string, unknown> | null;
      newValues?: Record<string, unknown> | null;
};

/** Shape of a row returned by the audit read routines (snake_case). */
export type AuditLogResponseDTO = {
      audit_id: string;
      employee_id: string;
      action: (typeof AUDIT_ACTIONS)[number];
      entity_type: string;
      entity_id: string;
      description: string | null;
      old_values: Record<string, unknown> | null;
      new_values: Record<string, unknown> | null;
      created_at: string;
};
