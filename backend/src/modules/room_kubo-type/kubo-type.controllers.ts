import type { Request, Response } from "express";
import type {
      CreateKuboTypeDTO,
      UpdateKuboTypeDTO,
} from "./repository/kubo-type.schema";
import { KuboTypeFilterSchema } from "./repository/kubo-type.schema";
import { AppError, getPagination, handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
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

            const filters = KuboTypeFilterSchema.safeParse({
                  search: req.query.search,
                  minCapacity: req.query.minCapacity,
                  maxCapacity: req.query.maxCapacity,
            });

            if (!filters.success) {
                  throw new AppError(
                        400,
                        filters.error.issues
                              .map((issue) =>
                                    issue.path.length
                                          ? `${issue.path.join(".")}: ${issue.message}`
                                          : issue.message,
                              )
                              .join("; "),
                  );
            }

            const kuboTypes =
                  filters.data.search !== undefined ||
                  filters.data.minCapacity !== undefined ||
                  filters.data.maxCapacity !== undefined
                        ? await searchKuboTypesService({
                                search: filters.data.search,
                                minCapacity: filters.data.minCapacity,
                                maxCapacity: filters.data.maxCapacity,
                                pagination,
                          })
                        : await getAllKuboTypesService(pagination);

            res.status(200).json({
                  success: true,
                  count: kuboTypes.length,
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
            const kuboTypeId = String(req.params.kuboTypeId);
            const data = req.body as UpdateKuboTypeDTO;
            const kuboTypes = await updateKuboTypeService(kuboTypeId, data);

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
            await deleteKuboTypeService(req.params.kuboTypeId as string);

            res.status(204).json();
      } catch (error: any) {
            logger.error("Failed to delete Kubo type", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
