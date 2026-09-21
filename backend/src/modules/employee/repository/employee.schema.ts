import { z } from "zod";

const EMPLOYEE_STATUS = [
      "active",
      "inactive",
      "suspended",
      "on leave",
      "terminated",
] as const;

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
export const UpdateEmployeeSchame = EmployeeSchema.pick({
      employeeId: true,
}).merge(EmployeeSchema.omit({ employeeId: true }).partial());
export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchame>;

// Response DTO
export type EmployeeResponseDTO = z.infer<typeof EmployeeSchema>;
