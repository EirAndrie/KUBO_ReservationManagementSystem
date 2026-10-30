import type { Request, Response } from "express";
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
) => {
      try {
            const data = req.body as CreateRoleDTO;
            const roles = await createRoleService(data);

            res.status(201).json({
                  success: true,
                  message: `Role: ${data.roleName} created successfully`,
                  roles,
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
) => {
      try {
            const roles = await getRolesService();
            res.json({
                  success: true,
                  message: "Roles retrieved successfully",
                  roles
            });
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
) => {
      try {
            const roles = await getRoleByIdService(req.params.roleId as string);
            res.status(200).json({
                  success: true,
                  message: `Role: ${roles.roleName} retrieved successfully`,
                  roles,
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
) => {
      try {
            const roleId = String(req.params.roleId);
            const data = req.body as UpdateRoleDTO;

            const roles = await updateRoleService(roleId, data);
            res.status(200).json({
                  success: true,
                  message: `Role: ${roles?.roleName} updated successfully`,
                  roles,
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
) => {
      try {
            await deleteRoleService(req.params.roleId as string);

            res.status(204).json();
      } catch (error: any) {
            logger.error("Failed to delete Role", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
