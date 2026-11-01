import type { Request, Response } from "express";
import type {
      CreateKuboDTO,
      UpdateKuboDTO,
      ChangeKuboStatusDTO,
} from "./repository/kubo.schema";
import {
      KuboAvailabilitySchema,
      KuboFilterSchema,
} from "./repository/kubo.schema";
import { AppError, getPagination, handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import {
      createKuboService,
      getAllKubosService,
      getKuboByIdService,
      updateKuboService,
      changeKuboStatusService,
      deleteKuboService,
      searchKubosService,
      getAvailableKubosService,
} from "./kubo.services";

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const createKuboController = async (req: Request, res: Response) => {
      try {
            const data = req.body as CreateKuboDTO;
            const kubos = await createKuboService(data);

            res.status(201).json({
                  success: true,
                  message: "Successfully created Kubo",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to create Kubo", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getAllKubosController = async (req: Request, res: Response) => {
      try {
            const pagination = getPagination(req.query);

            const filters = KuboFilterSchema.safeParse({
                  search: req.query.search,
                  kuboTypeId: req.query.kuboTypeId,
                  status: req.query.status,
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

            const kubos =
                  filters.data.search !== undefined ||
                  filters.data.kuboTypeId !== undefined ||
                  filters.data.status !== undefined
                        ? await searchKubosService({
                                search: filters.data.search,
                                kuboTypeId: filters.data.kuboTypeId,
                                status: filters.data.status,
                                pagination,
                          })
                        : await getAllKubosService(pagination);

            res.status(200).json({
                  success: true,
                  count: kubos.length,
                  message: "Successfully listed all kubos",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to list Kubos", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getKuboByIdController = async (req: Request, res: Response) => {
      try {
            const kubos = await getKuboByIdService(
                  req.params.kuboId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched kubo by its ID",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to get Kubo by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateKuboController = async (req: Request, res: Response) => {
      try {
            const kuboId = String(req.params.kuboId);
            const data = req.body as UpdateKuboDTO;
            const kubos = await updateKuboService(kuboId, data);

            res.status(200).json({
                  success: true,
                  message: "Successfully updated kubo",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to update Kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const changeKuboStatusController = async (
      req: Request,
      res: Response,
) => {
      try {
            const kuboId = String(req.params.kuboId);
            const data = req.body as ChangeKuboStatusDTO;
            const kubos = await changeKuboStatusService(kuboId, data.status);

            res.status(200).json({
                  success: true,
                  message: "Successfully changed kubo status",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to change Kubo status", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteKuboController = async (req: Request, res: Response) => {
      try {
            await deleteKuboService(req.params.kuboId as string);

            res.status(204).json();
      } catch (error: any) {
            logger.error("Failed to delete Kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getKubosByTypeController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);
            const kubos = await searchKubosService({
                  kuboTypeId: String(req.params.kuboTypeId),
                  pagination,
            });

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched kubos by type",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to get kubos by type", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getAvailableKubosController = async (
      req: Request,
      res: Response,
) => {
      try {
            const parsed = KuboAvailabilitySchema.safeParse({
                  checkIn: req.query.checkIn,
                  checkOut: req.query.checkOut,
                  kuboTypeId: req.query.kuboTypeId,
            });

            if (!parsed.success) {
                  throw new AppError(
                        400,
                        parsed.error.issues
                              .map((issue) =>
                                    issue.path.length
                                          ? `${issue.path.join(".")}: ${issue.message}`
                                          : issue.message,
                              )
                              .join("; "),
                  );
            }

            const kubos = await getAvailableKubosService({
                  checkIn: toDateOnly(parsed.data.checkIn),
                  checkOut: toDateOnly(parsed.data.checkOut),
                  kuboTypeId: parsed.data.kuboTypeId,
            });

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched available kubos",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to fetch available kubos", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
