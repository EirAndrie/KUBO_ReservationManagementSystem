import { z } from "zod";

export const employeeCreateSchema = z.object({
      roleId: z.uuid({ message: "roleId must be a valid UUID" }),
      firstName: z
            .string()
            .min(1, { message: "First name is required" })
            .max(50, { message: "First name must be at most 50 characters" }),
      lastName: z
            .string()
            .min(1, { message: "Last name is required" })
            .max(50, { message: "Last name must be at most 50 characters" }),
      username: z
            .string()
            .min(1, { message: "Username is required" })
            .max(30, { message: "Username must be at most 30 characters" }),
      passwordHash: z.string().min(1, { message: "Password hash is required" }),
      status: z
            .string()
            .refine(
                  (val) => ["active", "inactive", "suspended"].includes(val),
                  {
                        message: "Status must be one of: active, inactive, suspended",
                  },
            ),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();
export type EmployeeCreateDTO = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateDTO = z.infer<typeof employeeUpdateSchema>;
