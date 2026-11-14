import type { Request, Response } from "express";
import type { LoginDTO } from "./repository/auth.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { loginService, getMeService, logoutService } from "./auth.services";

/** POST /auth/login – verify credentials and issue an access token. */
export const loginController = async (req: Request, res: Response) => {
      try {
            const data = req.body as LoginDTO;
            const { accessToken, employee } = await loginService(data);

            res.status(200).json({
                  success: true,
                  message: "Login successful",
                  accessToken,
                  tokenType: "Bearer",
                  employee,
            });
      } catch (error: any) {
            logger.error("Login failed", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

/** POST /auth/logout – revoke the presented access token and audit the logout. */
export const logoutController = async (req: Request, res: Response) => {
      try {
            await logoutService(req.auth!);

            res.status(204).json();
      } catch (error: any) {
            logger.error("Logout failed", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

/** GET /auth/me – return the current employee profile. */
export const getMeController = async (req: Request, res: Response) => {
      try {
            const employee = await getMeService(req.auth!.employeeId);

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched current employee",
                  employee,
            });
      } catch (error: any) {
            logger.error("Failed to fetch current employee", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
