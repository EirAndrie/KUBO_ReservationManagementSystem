import type { Request, Response } from "express";
import type {
      CreatePaymentDTO,
      UpdatePaymentDTO,
} from "./repository/payment.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      createPaymentService,
      getPaymentsByReservationService,
      getPaymentByIdService,
      updatePaymentService,
      deletePaymentService,
      searchPaymentsService,
      refundPaymentService,
} from "./payment.services";

// POST /reservations/:reservationId/payments – create payment
export const createPaymentController = async (req: Request, res: Response) => {
      try {
            const data = {
                  ...(req.body as Omit<CreatePaymentDTO, "reservationId">),
                  reservationId: req.params.reservationId as string,
            } as CreatePaymentDTO;
            const payments = await createPaymentService(data);

            res.status(201).json({
                  success: true,
                  message: "Successfully created Payment for Reservation",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to create payment", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /reservations/:reservationId/payments – list payments for a reservation
export const getPaymentsByReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const payments = await getPaymentsByReservationService(
                  req.params.reservationId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched payments by reservation",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to list payments for reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /payments/:paymentId – single payment
export const getPaymentByIdController = async (req: Request, res: Response) => {
      try {
            const payments = await getPaymentByIdService(
                  req.params.paymentId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched Payment by its ID",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to get payment by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// PATCH /payments/:paymentId – update payment
export const updatePaymentController = async (req: Request, res: Response) => {
      try {
            const data = {
                  ...(req.body as Omit<UpdatePaymentDTO, "paymentId">),
                  paymentId: req.params.paymentId as string,
            } as UpdatePaymentDTO;

            const payments = await updatePaymentService(data);

            res.status(200).json({
                  success: true,
                  message: "Successfully updated Payment",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to update payment", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// DELETE /payments/:paymentId – delete payment
export const deletePaymentController = async (req: Request, res: Response) => {
      try {
            const payments = await deletePaymentService(
                  req.params.paymentId as string,
            );

            res.status(204).json({
                  success: true,
                  message: "Successfully deleted Payment",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to delete payment", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /payments – filtered list with pagination
export const searchPaymentsController = async (req: Request, res: Response) => {
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
            const paymentStatus =
                  typeof req.query.paymentStatus === "string"
                        ? req.query.paymentStatus
                        : undefined;
            const paymentMethod =
                  typeof req.query.paymentMethod === "string"
                        ? req.query.paymentMethod
                        : undefined;

            const payments = await searchPaymentsService({
                  reservationId,
                  employeeId,
                  paymentStatus,
                  paymentMethod,
                  pagination,
            });

            res.status(201).json({
                  success: true,
                  message: "Successfully fetched Payment by filter",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to search payments", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// POST /reservations/:reservationId/payments/refund – record a refund
export const refundPaymentController = async (req: Request, res: Response) => {
      try {
            // body should contain same fields as CreatePaymentDTO except reservationId & transactionType
            const body = req.body as Omit<
                  CreatePaymentDTO,
                  "reservationId" | "transactionType"
            >;

            const payments = await refundPaymentService(
                  req.params.reservationId as string,
                  body,
            );

            res.status(201).json({
                  success: true,
                  message: "Successfully refunded Payment",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to record refund", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
