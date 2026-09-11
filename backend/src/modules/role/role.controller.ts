import { Request, Response, NextFunction } from "express";
import {
      getAllRolesService,
      getRoleByIdService,
      createRoleService,
      updateRoleService,
      deleteRoleService,
} from "./role.service";
import {
      roleCreateSchema,
      roleUpdateSchema,
} from "./repositories/role.validations";
import {
      getPagination,
      handleControllerError,
      validateBody,
} from "../../utils/http";
import logger from "../../utils/logger";

// Controller functions – each exported individually for clear usage
export const getAllRolesController = async (
      _req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            // Validate pagination query parameters (defaults applied)
            const pagination = getPagination(_req.query);
            logger.info("Fetching all roles", { pagination });
            const result = await getAllRolesService(pagination);
            res.json(result);
      } catch (err) {
            handleControllerError(res, err);
      }
};

export const getRoleByIdController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const roleId = Array.isArray(req.params.id)
                  ? req.params.id[0]
                  : req.params.id;
            const role = await getRoleByIdService(roleId);
            if (!role) {
                  return res.status(404).json({ message: "Role not found" });
            }
            res.json(role);
      } catch (err) {
            handleControllerError(res, err);
      }
};

export const createRoleController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const data = validateBody(roleCreateSchema, req.body);
            const newRole = await createRoleService(data);
            logger.info("Created new role", { roleId: newRole.roleId });
            res.status(201).json(newRole);
      } catch (err) {
            handleControllerError(res, err);
      }
};

export const updateRoleController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const data = validateBody(roleUpdateSchema, req.body);
            const roleId = Array.isArray(req.params.id)
                  ? req.params.id[0]
                  : req.params.id;
            const updated = await updateRoleService(roleId, data);
            if (!updated) {
                  return res.status(404).json({ message: "Role not found" });
            }
            logger.info("Updated role", { roleId });
            res.json(updated);
      } catch (err) {
            handleControllerError(res, err);
      }
};

export const deleteRoleController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const roleId = Array.isArray(req.params.id)
                  ? req.params.id[0]
                  : req.params.id;
            await deleteRoleService(roleId);
            logger.info("Deleted role", { roleId });
            res.status(204).send();
      } catch (err) {
            handleControllerError(res, err);
      }
};
