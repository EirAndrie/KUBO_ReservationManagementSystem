import type { Request, Response, NextFunction } from "express";
import type {
      CreateKuboTypeDTO,
      UpdateKuboTypeDTO,
} from "./repository/kubo-type.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      createKuboTypeService,
      getAllKuboTypesService,
      getKuboTypeByIdService,
      updateKuboTypeService,
      deleteKuboTypeService,
      searchKuboTypesService,
} from "./kubo-type.services";

export const createKuboTypeController = async (req: Request, res: Response) => {
      try {
            const data = req.body as CreateKuboTypeDTO;
            const kuboTypes = await createKuboTypeService(data);

            res.status(201).json({
                  success: true,
                  message: "Kubo type created successfully",
                  kuboTypes,
            });
      } catch (error: any) {
            logger.error("Failed to create Kubo type", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getAllKuboTypesController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);

            const search =
                  typeof req.query.search === "string"
                        ? req.query.search
                        : undefined;
            const minCapacity = req.query.minCapacity
                  ? Number(req.query.minCapacity)
                  : undefined;
            const maxCapacity = req.query.maxCapacity
                  ? Number(req.query.maxCapacity)
                  : undefined;

            let kuboTypes;
            if (
                  search ||
                  minCapacity !== undefined ||
                  maxCapacity !== undefined
            ) {
                  kuboTypes = await searchKuboTypesService({
                        search,
                        minCapacity,
                        maxCapacity,
                        pagination,
                  });
            } else {
                  kuboTypes = await getAllKuboTypesService();
            }

            res.status(200).json({
                  success: true,
                  message: "Successfully listed kubo types",
                  kuboTypes,
            });
      } catch (error: any) {
            logger.error("Failed to list Kubo types", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getKuboTypeByIdController = async (
      req: Request,
      res: Response,
) => {
      try {
            const kuboTypes = await getKuboTypeByIdService(
                  req.params.kuboTypeId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched kubo type by its ID",
                  kuboTypes,
            });
      } catch (error: any) {
            logger.error("Failed to get Kubo type by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateKuboTypeController = async (req: Request, res: Response) => {
      try {
            const data = req.body as UpdateKuboTypeDTO;
            const kuboTypes = await updateKuboTypeService({
                  ...data,
                  kuboTypeId: req.params.kuboTypeId as string,
            });

            res.status(200).json({
                  success: true,
                  message: "Successfully updated kubo type",
                  kuboTypes,
            });
      } catch (error: any) {
            logger.error("Failed to update Kubo type", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteKuboTypeController = async (req: Request, res: Response) => {
      try {
            const kuboTypes = await deleteKuboTypeService(
                  req.params.kuboTypeId as string,
            );

            res.status(204).json({
                  success: true,
                  message: "Successfully deleted kubo type",
                  kuboTypes,
            });
      } catch (error: any) {
            logger.error("Failed to delete Kubo type", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
