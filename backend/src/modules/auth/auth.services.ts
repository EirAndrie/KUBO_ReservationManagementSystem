import bcrypt from "bcrypt";
import { AppError } from "../../utils/http";
import type { LoginDTO, AuthenticatedEmployee } from "./repository/auth.schema";
import {
      getLoginCredentials,
      getAuthenticatedEmployee,
      revokeToken,
} from "./repository/auth.repository";
import { writeAuditLog } from "../audit-logs/repository/audit-log.repository";
import { signAccessToken, type AuthContext } from "../../utils/auth";

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

      // BR-067: successful login must be audited. Fail closed so a login is
      // never silently recorded without its audit row.
      await writeAuditLog({
            employeeId: credentials.employeeId,
            action: "Login",
            entityType: "employee",
            entityId: credentials.employeeId,
            description: `Successful login for ${credentials.username}`,
      });

      return {
            accessToken: signAccessToken(employee),
            employee,
      };
};

/**
 * Ends the caller's session: revokes the presented access token by its `jti`
 * until the token's own expiry, then records the logout audit event (BR-067).
 * Only this token is revoked; the employee's other sessions stay valid.
 *
 * Revocation runs first so a failed audit write never leaves a "logged out"
 * token usable. Both failures surface as an error to the caller.
 */
export const logoutService = async (auth: AuthContext): Promise<void> => {
      if (!auth.tokenId || !auth.tokenExpiresAt) {
            throw new AppError(401, "Session has ended. Please sign in again");
      }

      await revokeToken(auth.tokenId, auth.employeeId, auth.tokenExpiresAt);

      await writeAuditLog({
            employeeId: auth.employeeId,
            action: "Logout",
            entityType: "employee",
            entityId: auth.employeeId,
            description: "Successful logout",
      });
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
