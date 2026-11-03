import jwt from "jsonwebtoken";
import { AUTH_CONFIG } from "../config/auth";

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
}

/** Claims carried inside a signed access token. */
export interface AuthTokenClaims extends jwt.JwtPayload {
      employeeId: string;
      roleId: string;
      roleName: string;
}

/**
 * The business role names understood by the authorization middleware. The
 * stored `role_name` values are free text; matching is case-insensitive and
 * tolerant of the `ADMIN`/`ADMINISTRATOR` and `STAFF` variants seen in the
 * seed data.
 */
export type RoleName = "Administrator" | "Staff";

const normalizeRoleName = (name: string) => name.trim().toLowerCase();

/** Whether a stored role name denotes the administrative role. */
export const isAdministrator = (roleName: string): boolean => {
      const normalized = normalizeRoleName(roleName);
      return normalized === "admin" || normalized === "administrator";
};

/** Whether a stored role name denotes the operational staff role. */
export const isStaff = (roleName: string): boolean =>
      normalizeRoleName(roleName) === "staff";

/** Signs a short-lived access token for the given authenticated employee. */
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
