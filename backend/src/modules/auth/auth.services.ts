import bcrypt from "bcrypt";
import { AppError } from "../../utils/http";
import type { LoginDTO, AuthenticatedEmployee } from "./repository/auth.schema";
import {
      getLoginCredentials,
      getAuthenticatedEmployee,
} from "./repository/auth.repository";
import { signAccessToken } from "../../utils/auth";

/**
 * A precomputed bcrypt hash compared against when the username is unknown, so
 * a missing account and a wrong password take roughly the same time and the
 * API does not reveal which usernames exist.
 */
const DUMMY_PASSWORD_HASH =
      "$2b$12$5KviyFO4jYbdOkPe1SyVOeGbbECRI6q0iPgcIv1NfbiHJWeJPabsa";

export interface LoginResult {
      accessToken: string;
      employee: AuthenticatedEmployee;
}

/**
 * Verifies sign-in credentials and issues an access token.
 *
 * Only `Active` employees may sign in (BR-004). Invalid credentials always
 * produce the same generic 401 message; a non-active account produces 403.
 */
export const loginService = async (data: LoginDTO): Promise<LoginResult> => {
      const credentials = await getLoginCredentials(data.username);

      const passwordMatches = await bcrypt.compare(
            data.password,
            credentials?.passwordHash ?? DUMMY_PASSWORD_HASH,
      );

      if (!credentials || !passwordMatches) {
            throw new AppError(401, "Invalid username or password");
      }

      if (credentials.status !== "Active") {
            throw new AppError(403, "Account is not active");
      }

      const employee: AuthenticatedEmployee = {
            employeeId: credentials.employeeId,
            roleId: credentials.roleId,
            roleName: credentials.roleName,
            firstName: credentials.firstName,
            lastName: credentials.lastName,
            username: credentials.username,
            status: credentials.status,
      };

      return {
            accessToken: signAccessToken(employee),
            employee,
      };
};

/**
 * Returns the current employee profile. Identity is already enforced by the
 * `authenticate` middleware; this only refreshes the profile from the DB.
 */
export const getMeService = async (
      employeeId: string,
): Promise<AuthenticatedEmployee> => {
      const employee = await getAuthenticatedEmployee(employeeId);
      if (!employee) {
            throw new AppError(404, "Employee not found");
      }
      return employee;
};
