import { z } from "zod";

const EMPLOYEE_STATUS = [
      "Active",
      "Inactive",
      "Suspended",
      "OnLeave",
      "Terminated",
] as const;

const EMPLOYEE_STATUS_DB = [
      "Active",
      "Inactive",
      "Suspended",
      "OnLeave",
      "Terminated",
] as const;

type EmployeeStatusDB = (typeof EMPLOYEE_STATUS_DB)[number];

const EMPLOYEE_STATUS_QUERY_ALIASES: Record<string, EmployeeStatusDB> = {
      active: "Active",
      inactive: "Inactive",
      suspended: "Suspended",
      onleave: "OnLeave",
      terminated: "Terminated",
};

const normalizeEmployeeStatusQuery = (value: unknown) => {
      if (typeof value !== "string") {
            return value;
      }

      const trimmed = value.trim();
      if (trimmed === "") {
            return undefined;
      }

      const key = trimmed.toLowerCase().replace(/\s+/g, "");
      return EMPLOYEE_STATUS_QUERY_ALIASES[key] ?? value;
};

const optionalFilterText = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.string().trim().min(1).max(100).optional(),
);

export const EmployeeFilterSchema = z.object({
      role: optionalFilterText,
      status: z.preprocess(
            normalizeEmployeeStatusQuery,
            z.enum(EMPLOYEE_STATUS_DB, {
                  message: "Invalid employee status filter",
            }).optional(),
      ),
      search: optionalFilterText,
});

export type EmployeeFilterDTO = z.infer<typeof EmployeeFilterSchema>;

export const EmployeeSchema = z.object({
      employeeId: z.string().uuid(),
      roleId: z.string().uuid({
            message: "Invalid role ID format, must be UUID to reference",
      }),
      firstName: z.string({ message: "Employee first name is required" }),
      lastName: z.string({ message: "Emplyoee last name is required" }),
      username: z.string({ message: "Employee username is required" }),
      passwordHash: z
            .string()
            .min(8, { message: "Passsword must be at least 8 characters long" })
            .max(12, { message: "Password cannot exceed 12 characters" })
            .regex(
                  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                  {
                        message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
                  },
            ),
      status: z.enum(EMPLOYEE_STATUS, {
            message: "Invalid employee status entry, did not follow system integrated status enums",
      }),
});

// Schema and DTO for creating
export const CreateEmployeeSchema = EmployeeSchema.omit({ employeeId: true });
export type CreateEmployeeDTO = z.infer<typeof CreateEmployeeSchema>;

// Schema and DTP fpr updating
export const UpdateEmployeeSchame = EmployeeSchema.omit({
      employeeId: true,
}).partial();
export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchame>;

// Response DTO
export type EmployeeResponseDTO = z.infer<typeof EmployeeSchema>;
