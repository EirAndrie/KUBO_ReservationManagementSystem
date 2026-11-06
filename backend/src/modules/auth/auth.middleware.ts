import type { Request, Response, NextFunction } from "express";
import { AppError, handleControllerError } from "../../utils/http";
import {
      extractBearerToken,
      verifyAccessToken,
      isAdministrator,
      isStaff,
      type AuthContext,
      type RoleName,
} from "../../utils/auth";
import { ADMINISTRATOR_ROLE } from "../../utils/role-names";
import { getAuthenticatedEmployee } from "./repository/auth.repository";
import logger from "../../utils/logger";

/**
 * Verifies the Bearer token, then re-reads the employee + role from the
 * database so that role and status changes take effect immediately (BR-004,
 * BR-005). The actor identity is attached to `req.auth`.
 */
export const authenticate = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const token = extractBearerToken(req.headers.authorization);

            if (!token) {
                  return handleControllerError(
                        res,
                        new AppError(401, "Authentication required"),
                  );
            }

            const claims = verifyAccessToken(token);

            const employee = await getAuthenticatedEmployee(claims.employeeId);

            if (!employee) {
                  return handleControllerError(
                        res,
                        new AppError(401, "Authentication required"),
                  );
            }

            if (employee.status !== "Active") {
                  return handleControllerError(
                        res,
                        new AppError(403, "Account is not active"),
                  );
            }

            const auth: AuthContext = {
                  employeeId: employee.employeeId,
                  roleId: employee.roleId,
                  roleName: employee.roleName,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  username: employee.username,
                  status: employee.status,
            };

            req.auth = auth;
            next();
      } catch (error: any) {
            if (error?.name === "TokenExpiredError") {
                  return handleControllerError(
                        res,
                        new AppError(401, "Token has expired"),
                  );
            }

            if (error?.name === "JsonWebTokenError") {
                  return handleControllerError(
                        res,
                        new AppError(401, "Invalid token"),
                  );
            }

            logger.error("Authentication failed", {
                  message: error?.message,
                  stack: error?.stack,
            });
            handleControllerError(
                  res,
                  error,
                  "Authentication failed",
            );
      }
};

const matchesRole = (roleName: string, role: RoleName): boolean =>
      role === ADMINISTRATOR_ROLE
            ? isAdministrator(roleName)
            : isStaff(roleName);

/**
 * Restricts a route to one or more business roles. Must run after
 * `authenticate` (which populates `req.auth`). Unauthenticated requests get
 * 401; authenticated requests with an insufficient role get 403.
 */
export const authorizeRoles = (...roles: RoleName[]) => {
      return (req: Request, res: Response, next: NextFunction) => {
            const auth = req.auth;

            if (!auth) {
                  return handleControllerError(
                        res,
                        new AppError(401, "Authentication required"),
                  );
            }

            const allowed = roles.some((role) =>
                  matchesRole(auth.roleName, role),
            );

            if (!allowed) {
                  return handleControllerError(
                        res,
                        new AppError(403, "Insufficient privileges"),
                  );
            }

            next();
      };
};
