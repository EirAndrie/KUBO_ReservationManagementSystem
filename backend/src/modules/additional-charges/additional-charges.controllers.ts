import type { Request, Response } from "express";
import type {
      CreateAdditionalChargeDTO,
      UpdateAdditionalChargeDTO,
} from "./repository/additional-charge.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      createAdditionalChargeService,
      getChargesByReservationService,
      getAdditionalChargeByIdService,
      updateAdditionalChargeService,
      deleteAdditionalChargeService,
      searchAdditionalChargesService,
} from "./additional-charges.services";

// POST /reservations/:reservationId/charges – create charge
export const createAdditionalChargeController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = {
                  ...(req.body as Omit<
                        CreateAdditionalChargeDTO,
                        "resrvationId"
                  >),
                  resrvationId: req.params.reservationId as string,
            } as CreateAdditionalChargeDTO;

            const additionalCharges = await createAdditionalChargeService(data);
            res.status(201).json({
                  success: true,
                  message: "Successfully charged Additional Charges to a reservation",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to create additional charge", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /reservations/:reservationId/charges – list charges for reservation
export const getChargesByReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const additionalCharges = await getChargesByReservationService(
                  req.params.reservationId as string,
            );

            res.json({
                  success: true,
                  message: "Successfully fetched all reservation additional charges",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to list charges for reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /charges/:chargeId – single charge
export const getAdditionalChargeByIdController = async (
      req: Request,
      res: Response,
) => {
      try {
            const additionalCharges = await getAdditionalChargeByIdService(
                  req.params.chargeId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched Additional Charge by its ID",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to get additional charge by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// PATCH /charges/:chargeId – update charge
export const updateAdditionalChargeController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = {
                  ...(req.body as Omit<
                        UpdateAdditionalChargeDTO,
                        "additionalChargeId"
                  >),
                  additionalChargeId: req.params.chargeId as string,
            } as UpdateAdditionalChargeDTO;

            const additionalCharges = await updateAdditionalChargeService(data);
            res.status(200).json({
                  success: true,
                  message: "Successfully updated Additional Charge details",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to update additional charge", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// DELETE /charges/:chargeId – delete charge
export const deleteAdditionalChargeController = async (
      req: Request,
      res: Response,
) => {
      try {
            const additionalCharges = await deleteAdditionalChargeService(
                  req.params.chargeId as string,
            );

            res.status(201).json({
                  success: true,
                  message: "Successfully deleted Additional Charge",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to delete additional charge", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /charges – filtered list with pagination
export const searchAdditionalChargesController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);

            const reservationId =
                  typeof req.query.reservationId === "string"
                        ? req.query.reservationId
                        : undefined;
            const employeeId =
                  typeof req.query.employeeId === "string"
                        ? req.query.employeeId
                        : undefined;
            const chargeType =
                  typeof req.query.chargeType === "string"
                        ? req.query.chargeType
                        : undefined;

            const additionalCharges = await searchAdditionalChargesService({
                  reservationId,
                  employeeId,
                  chargeType,
                  pagination,
            });

            res.status(201).json({
                  success: true,
                  message: "Successfully searched Additional Charges with filters",
                  additionalCharges,
            });
      } catch (error: any) {
            logger.error("Failed to search additional charges", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
