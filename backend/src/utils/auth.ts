import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { AUTH_CONFIG } from "../config/auth";
import {
      ADMINISTRATOR_ROLE,
      STAFF_ROLE,
      type RoleName,
} from "./role-names";

export type { RoleName } from "./role-names";

/**
 * The authenticated employee identity attached to `req.auth` after a request
 * passes the `authenticate` middleware. It is re-read from the database on
 * every request so role and status changes take effect immediately.
 */
export interface AuthContext {
      employeeId: string;
      roleId: string;
      roleName: string;
      firstName: string;
      lastName: string;
      username: string;
      status: string;
      /** The access token's unique id (`jti`); used to revoke it on logout. */
      tokenId?: string;
      /** When the access token expires; revocation rows are kept until then. */
      tokenExpiresAt?: Date;
}

/** Claims carried inside a signed access token. */
export interface AuthTokenClaims extends jwt.JwtPayload {
      employeeId: string;
      roleId: string;
      roleName: string;
}

/**
 * Whether a stored role name denotes the administrative role. Stored names are
 * canonical lowercase values, so the comparison is exact (BR-001, BR-005).
 */
export const isAdministrator = (roleName: string): boolean =>
      roleName === ADMINISTRATOR_ROLE;

/** Whether a stored role name denotes the operational staff role. */
export const isStaff = (roleName: string): boolean =>
      roleName === STAFF_ROLE;

/**
 * Signs a short-lived access token for the given authenticated employee. Each
 * token gets a random `jti` so a single session can be revoked at logout
 * without affecting the employee's other sessions.
 */
export const signAccessToken = (context: AuthContext): string => {
      const payload: AuthTokenClaims = {
            employeeId: context.employeeId,
            roleId: context.roleId,
            roleName: context.roleName,
      };

      return jwt.sign(payload, AUTH_CONFIG.jwtSecret, {
            issuer: AUTH_CONFIG.issuer,
            audience: AUTH_CONFIG.audience,
            expiresIn: AUTH_CONFIG.jwtExpiresIn as jwt.SignOptions["expiresIn"],
            subject: context.employeeId,
            jwtid: randomUUID(),
      });
};

/**
 * Verifies a token and returns its claims. Throws a `jwt.JsonWebTokenError`
 * or `jwt.TokenExpiredError` on failure; callers translate those into 401.
 */
export const verifyAccessToken = (token: string): AuthTokenClaims => {
      const claims = jwt.verify(token, AUTH_CONFIG.jwtSecret, {
            issuer: AUTH_CONFIG.issuer,
            audience: AUTH_CONFIG.audience,
      });

      if (typeof claims === "string") {
            throw new jwt.JsonWebTokenError("Unexpected token payload");
      }

      return claims as AuthTokenClaims;
};

/** Extracts a Bearer token from the Authorization header, if present. */
export const extractBearerToken = (
      authorizationHeader: string | undefined,
): string | null => {
      if (!authorizationHeader) {
            return null;
      }

      const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

      if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
            return null;
      }

      return token;
};

declare global {
      namespace Express {
            interface Request {
                  auth?: AuthContext;
            }
      }
}
