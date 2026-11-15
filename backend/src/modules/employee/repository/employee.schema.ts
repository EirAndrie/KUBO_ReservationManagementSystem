/**
 * Employee names must start with a letter and may contain Unicode letters,
 * combining marks, spaces, hyphens, apostrophes, and periods. Digits, emoji,
 * and other symbols are rejected.
 */
export const EMPLOYEE_NAME_PATTERN = /^[\p{L}\p{M}](?:[\p{L}\p{M} '’.-])*$/u;

import { z } from "zod";

const EMPLOYEE_STATUS_DB = [
      "Active",
      "Inactive",
      "Suspended",
      "OnLeave",
      "Terminated",
] as const;

type EmployeeStatusDB = (typeof EMPLOYEE_STATUS_DB)[number];

const EMPLOYEE_STATUS_ALIASES: Record<string, EmployeeStatusDB> = {
      active: "Active",
      inactive: "Inactive",
      suspended: "Suspended",
      onleave: "OnLeave",
      terminated: "Terminated",
};

const normalizeEmployeeStatus = (value: unknown) => {
      if (typeof value !== "string") {
            return value;
      }

      const trimmed = value.trim();
      if (trimmed === "") {
            return undefined;
      }

      const key = trimmed.toLowerCase().replace(/\s+/g, "");
      return EMPLOYEE_STATUS_ALIASES[key] ?? value;
};

const EmployeeStatusSchema = z.preprocess(
      normalizeEmployeeStatus,
      z.enum(EMPLOYEE_STATUS_DB, {
            message: "Invalid employee status entry, did not follow system integrated status enums",
      }),
);

const PASSWORD_SCHEMA = z
      .string()
      .min(8, { message: "Passsword must be at least 8 characters long" })
      .max(12, { message: "Password cannot exceed 12 characters" })
      .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            {
                  message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
            },
      );

const optionalFilterText = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.string().trim().min(1).max(100).optional(),
);

export const EmployeeFilterSchema = z.object({
      role: optionalFilterText,
      status: EmployeeStatusSchema.optional(),
      search: optionalFilterText,
});

export type EmployeeFilterDTO = z.infer<typeof EmployeeFilterSchema>;

export const EmployeeSchema = z.object({
      employeeId: z.string().uuid(),
      roleId: z.string().uuid({
            message: "Invalid role ID format, must be UUID to reference",
      }),
      firstName: z
            .string({ message: "Employee first name is required" })
            .trim()
            .min(1, { message: "Employee first name is required" })
            .max(100, { message: "Employee first name cannot exceed 100 characters" })
            .regex(EMPLOYEE_NAME_PATTERN, {
                  message:
                        "Employee first name may contain only letters, spaces, hyphens, apostrophes, and periods",
            }),
      lastName: z
            .string({ message: "Employee last name is required" })
            .trim()
            .min(1, { message: "Employee last name is required" })
            .max(100, { message: "Employee last name cannot exceed 100 characters" })
            .regex(EMPLOYEE_NAME_PATTERN, {
                  message:
                        "Employee last name may contain only letters, spaces, hyphens, apostrophes, and periods",
            }),
      username: z.string({ message: "Employee username is required" }),
      passwordHash: PASSWORD_SCHEMA,
      status: EmployeeStatusSchema,
});

export const EmployeeResponseSchema = EmployeeSchema.omit({
      passwordHash: true,
});

// Schema and DTO for creating
export const CreateEmployeeSchema = EmployeeSchema.omit({
      employeeId: true,
}).extend({
      status: EmployeeStatusSchema.default("Active"),
});
export type CreateEmployeeDTO = z.infer<typeof CreateEmployeeSchema>;

// Schema and DTO for updating profile data (passwords use the reset endpoint)
export const UpdateEmployeeSchame = EmployeeSchema.omit({
      employeeId: true,
      passwordHash: true,
}).partial();
export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchame>;

export const ResetEmployeePasswordSchema = z.object({
      password: PASSWORD_SCHEMA,
});
export type ResetEmployeePasswordDTO = z.infer<
      typeof ResetEmployeePasswordSchema
>;

// Response DTO
export type EmployeeResponseDTO = z.infer<typeof EmployeeResponseSchema>;
