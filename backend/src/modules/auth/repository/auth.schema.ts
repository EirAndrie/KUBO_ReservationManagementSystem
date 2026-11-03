import { z } from "zod";

/** Credentials supplied at sign-in. */
export const LoginSchema = z.object({
      username: z
            .string()
            .trim()
            .min(1, { message: "Username is required" })
            .max(100, { message: "Username cannot exceed 100 characters" }),
      password: z
            .string()
            .min(1, { message: "Password is required" })
            .max(255, { message: "Password cannot exceed 255 characters" }),
});

export type LoginDTO = z.infer<typeof LoginSchema>;

/**
 * Employee + role + password hash returned by the credential lookup. The hash
 * only ever travels between the repository and the auth service; it is never
 * returned by the API or written to logs.
 */
export interface LoginCredentials {
      employeeId: string;
      roleId: string;
      roleName: string;
      firstName: string;
      lastName: string;
      username: string;
      status: string;
      passwordHash: string;
}

/** Safe employee + role profile (no password hash). */
export interface AuthenticatedEmployee {
      employeeId: string;
      roleId: string;
      roleName: string;
      firstName: string;
      lastName: string;
      username: string;
      status: string;
}
