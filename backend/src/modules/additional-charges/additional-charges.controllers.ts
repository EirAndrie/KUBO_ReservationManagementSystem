import type { Request, Response } from "express";
import type {
      CreateCatalogItemDTO,
      UpdateCatalogItemDTO,
      ApplyCatalogChargeDTO,
      CustomChargeRequestDTO,
      ApproveChargeRequestDTO,
      RejectChargeRequestDTO,
      AddChargeCorrectionDTO,
      CatalogFilterDTO,
      ChargeFilterDTO,
      ChargeRequestFilterDTO,
} from "./repository/additional-charge.schema";
import {
      CatalogFilterSchema,
      ChargeFilterSchema,
      ChargeRequestFilterSchema,
} from "./repository/additional-charge.schema";
import { AppError, getPagination, handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import {
      createCatalogItemService,
      getCatalogItemsService,
      getCatalogItemByIdService,
      updateCatalogItemService,
      deleteCatalogItemService,
      applyCatalogChargeService,
      getChargesByReservationService,
      getChargeByIdService,
      getChargesService,
      deleteChargeService,
      addChargeCorrectionService,
      createChargeRequestService,
      getChargeRequestsService,
      getChargeRequestByIdService,
      approveChargeRequestService,
      rejectChargeRequestService,
      withdrawChargeRequestService,
} from "./additional-charges.services";

const zodMessage = (error: any) =>
      error.issues
            .map((issue: any) =>
                  issue.path.length
                        ? `${issue.path.join(".")}: ${issue.message}`
                        : issue.message,
            )
            .join("; ");

const parseOrThrow = <T>(result: any): T => {
      if (!result.success) {
            throw new AppError(400, zodMessage(result.error));
      }
      return result.data as T;
};

export const createCatalogItemController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as CreateCatalogItemDTO;
            const additionalChargeCatalog = await createCatalogItemService({
                  ...data,
                  employeeId: req.auth!.employeeId,
            });
            res.status(201).json({
                  success: true,
                  message: "Successfully created additional-charge catalog item",
                  additionalChargeCatalog,
            });
      } catch (error: any) {
            logger.error("Failed to create charge catalog item", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getCatalogItemsController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);
            const filters = parseOrThrow<CatalogFilterDTO>(
                  CatalogFilterSchema.safeParse({
                        search: req.query.search,
                        activeOnly: req.query.activeOnly,
                  }),
            );

            const additionalChargeCatalog = await getCatalogItemsService({
                  search: filters.search,
                  activeOnly: filters.activeOnly,
                  pagination,
            });

            res.status(200).json({
                  success: true,
                  count: additionalChargeCatalog.length,
                  message: "Successfully listed additional-charge catalog",
                  additionalChargeCatalog,
            });
      } catch (error: any) {
            logger.error("Failed to list charge catalog", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getCatalogItemByIdController = async (
      req: Request,
      res: Response,
) => {
      try {
            const additionalChargeCatalog = await getCatalogItemByIdService(
                  req.params.catalogId as string,
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully fetched catalog item",
                  additionalChargeCatalog,
            });
      } catch (error: any) {
            logger.error("Failed to get charge catalog item", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateCatalogItemController = async (
      req: Request,
      res: Response,
) => {
      try {
            const catalogId = String(req.params.catalogId);
            const data = req.body as UpdateCatalogItemDTO;
            const additionalChargeCatalog = await updateCatalogItemService(
                  catalogId,
                  { ...data, employeeId: req.auth!.employeeId },
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully updated catalog item",
                  additionalChargeCatalog,
            });
      } catch (error: any) {
            logger.error("Failed to update charge catalog item", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteCatalogItemController = async (
      req: Request,
      res: Response,
) => {
      try {
            await deleteCatalogItemService(
                  req.params.catalogId as string,
                  req.auth!.employeeId,
            );
            res.status(204).json();
      } catch (error: any) {
            logger.error("Failed to delete charge catalog item", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const applyCatalogChargeController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as ApplyCatalogChargeDTO;
            const additionalCharges = await applyCatalogChargeService(
                  req.params.reservationId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );
            res.status(201).json({
                  success: true,
                  message: "Successfully applied catalog charge",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to apply catalog charge", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getChargesByReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const additionalCharges = await getChargesByReservationService(
                  req.params.reservationId as string,
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully fetched reservation charges",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to list reservation charges", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getChargeByIdController = async (
      req: Request,
      res: Response,
) => {
      try {
            const additionalCharges = await getChargeByIdService(
                  req.params.chargeId as string,
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully fetched applied charge",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to get applied charge", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getChargesController = async (req: Request, res: Response) => {
      try {
            const pagination = getPagination(req.query);
            const filters = parseOrThrow<ChargeFilterDTO>(
                  ChargeFilterSchema.safeParse({
                        reservationId: req.query.reservationId,
                        employeeId: req.query.employeeId,
                        chargeType: req.query.chargeType,
                        createdFrom: req.query.createdFrom,
                        createdTo: req.query.createdTo,
                  }),
            );

            const additionalCharges = await getChargesService({
                  reservationId: filters.reservationId,
                  employeeId: filters.employeeId,
                  chargeType: filters.chargeType,
                  createdFrom: filters.createdFrom,
                  createdTo: filters.createdTo,
                  pagination,
            });

            res.status(200).json({
                  success: true,
                  message: "Successfully listed applied charges",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to list applied charges", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteChargeController = async (
      req: Request,
      res: Response,
) => {
      try {
            await deleteChargeService(
                  req.params.chargeId as string,
                  req.auth!.employeeId,
            );
            res.status(204).json();
      } catch (error: any) {
            logger.error("Failed to delete applied charge", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const addChargeCorrectionController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as AddChargeCorrectionDTO;
            const additionalCharges = await addChargeCorrectionService(
                  req.params.chargeId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );
            res.status(201).json({
                  success: true,
                  message: "Successfully recorded charge correction",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to add charge correction", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const createChargeRequestController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as CustomChargeRequestDTO;
            const additionalChargeRequests = await createChargeRequestService(
                  req.params.reservationId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );
            res.status(201).json({
                  success: true,
                  message: "Successfully submitted custom charge request",
                  additionalChargeRequests,
            });
      } catch (error: any) {
            logger.error("Failed to create custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getChargeRequestsController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);
            const filters = parseOrThrow<ChargeRequestFilterDTO>(
                  ChargeRequestFilterSchema.safeParse({
                        status: req.query.status,
                        reservationId: req.query.reservationId,
                        requestedBy: req.query.requestedBy,
                  }),
            );

            const additionalChargeRequests = await getChargeRequestsService({
                  status: filters.status,
                  reservationId: filters.reservationId,
                  requestedBy: filters.requestedBy,
                  pagination,
            });

            res.status(200).json({
                  success: true,
                  message: "Successfully listed custom charge requests",
                  additionalChargeRequests,
            });
      } catch (error: any) {
            logger.error("Failed to list custom charge requests", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getChargeRequestByIdController = async (
      req: Request,
      res: Response,
) => {
      try {
            const additionalChargeRequests = await getChargeRequestByIdService(
                  req.params.requestId as string,
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully fetched custom charge request",
                  additionalChargeRequests,
            });
      } catch (error: any) {
            logger.error("Failed to get custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const approveChargeRequestController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as ApproveChargeRequestDTO;
            const additionalChargeRequests = await approveChargeRequestService(
                  req.params.requestId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully approved custom charge request",
                  additionalChargeRequests,
            });
      } catch (error: any) {
            logger.error("Failed to approve custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const rejectChargeRequestController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as RejectChargeRequestDTO;
            const additionalChargeRequests = await rejectChargeRequestService(
                  req.params.requestId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully rejected custom charge request",
                  additionalChargeRequests,
            });
      } catch (error: any) {
            logger.error("Failed to reject custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const withdrawChargeRequestController = async (
      req: Request,
      res: Response,
) => {
      try {
            const additionalChargeRequests = await withdrawChargeRequestService(
                  req.params.requestId as string,
                  req.auth!.employeeId,
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully withdrew custom charge request",
                  additionalChargeRequests,
            });
      } catch (error: any) {
            logger.error("Failed to withdraw custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
