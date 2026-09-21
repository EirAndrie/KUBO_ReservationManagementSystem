import type { Request, Response, NextFunction } from "express";
import type { CreateRoleDTO, UpdateRoleDTO } from "./repository/role.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { AppError } from "../../utils/http";
import { getPagination } from "../../utils/http";
import {
      createRoleService,
      deleteRoleService,
      getRolesService,
      getRoleByIdService,
      updateRoleService,
} from "./role.services";

export const createRoleController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const data = req.body as CreateRoleDTO;

            const role = await createRoleService(data);

            res.status(201).json({
                  success: true,
                  data: role,
            });
      } catch (error: any) {
            logger.error("Failed to create Role", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getAllRolesController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const pagination = getPagination(req.query);
            const search =
                  typeof req.query.search === "string"
                        ? req.query.search
                        : undefined;
            const result = await getRolesService();
            res.json(result);
      } catch (error: any) {
            logger.error("Failed to list Roles", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getRoleByIdController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const role = await getRoleByIdService(req.params.roleId as string);
            res.status(200).json({
                  success: true,
                  data: role,
            });
      } catch (error: any) {
            logger.error("Failed to get Role by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateRoleController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const data = req.body as UpdateRoleDTO;
            const updated = await updateRoleService({
                  roleId: req.params.roleId as string,
            });
            res.status(200).json({
                  success: true,
                  data: updated,
            });
      } catch (error: any) {
            logger.error("Failed to update Role", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteRoleController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            await deleteRoleService(req.params.roleId as string);

            res.status(204).send();
      } catch (error: any) {
            logger.error("Failed to delete Role", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
