import { z } from "zod";

export const employeeCreateSchema = z.object({
      roleId: z.uuid(),
      firstName: z.string().min(1).max(50),
      lastName: z.string().min(1).max(50),
      username: z.string().min(1).max(30),
      passwordHash: z.string().min(1),
      status: z.enum(["active", "inactive", "suspended"]),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();
