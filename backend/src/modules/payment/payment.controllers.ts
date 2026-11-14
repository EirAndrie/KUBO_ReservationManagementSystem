import type { Request, Response } from "express";
import type {
      CreatePaymentDTO,
      RefundPaymentDTO,
      CreateChargeAdjustmentDTO,
      ReverseChargeAdjustmentDTO,
      UpdatePaymentStatusDTO,
      PaymentFilterDTO,
      CreateOverpaymentApprovalDTO,
} from "./repository/payment.schema";
import { PaymentFilterSchema } from "./repository/payment.schema";
import { AppError, getPagination, handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import {
      createPaymentService,
      getPaymentsByReservationService,
      getPaymentByIdService,
      updatePaymentStatusService,
      refundPaymentService,
      createChargeAdjustmentService,
      reverseChargeAdjustmentService,
      getPaymentsService,
      deletePaymentCleanupService,
      getOverpaymentApprovalsService,
      createOverpaymentApprovalService,
      revokeOverpaymentApprovalService,
} from "./payment.services";

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

// POST /reservations/:reservationId/payments – record a new payment (Pending)
export const createPaymentController = async (req: Request, res: Response) => {
      try {
            const data = req.body as CreatePaymentDTO;
            const payments = await createPaymentService(
                  req.params.reservationId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );

            res.status(201).json({
                  success: true,
                  message: "Successfully created Payment for Reservation",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to create payment", {
                  message: error.message,
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
                  count: payments.length,
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

// PATCH /payments/:paymentId/status – apply an allowed status transition
export const updatePaymentStatusController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as UpdatePaymentStatusDTO;
            const payments = await updatePaymentStatusService(
                  req.params.paymentId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully updated Payment status",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to update payment status", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// POST /reservations/:reservationId/payments/refund – record a refund
export const refundPaymentController = async (req: Request, res: Response) => {
      try {
            const data = req.body as RefundPaymentDTO;
            const payments = await refundPaymentService(
                  req.params.reservationId as string,
                  { ...data, employeeId: req.auth!.employeeId },
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

/** Records an audited Administrator credit against an applied charge. */
export const createChargeAdjustmentController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as CreateChargeAdjustmentDTO;
            const payments = await createChargeAdjustmentService(
                  req.params.reservationId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );

            res.status(201).json({
                  success: true,
                  message: "Successfully recorded charge reduction",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to record charge reduction", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

/** Records an audited Administrator reversal of a previous charge Adjustment. */
export const reverseChargeAdjustmentController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as ReverseChargeAdjustmentDTO;
            const payments = await reverseChargeAdjustmentService(
                  req.params.reservationId as string,
                  req.params.adjustmentId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );

            res.status(201).json({
                  success: true,
                  message: "Successfully reversed charge reduction",
                  payments,
            });
      } catch (error: any) {
            logger.error("Failed to reverse charge reduction", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /payments – filtered list with pagination
export const getPaymentsController = async (req: Request, res: Response) => {
      try {
            const pagination = getPagination(req.query);
            const filters = parseOrThrow<PaymentFilterDTO>(
                  PaymentFilterSchema.safeParse({
                        reservationId: req.query.reservationId,
                        employeeId: req.query.employeeId,
                        paymentStatus: req.query.paymentStatus,
                        paymentMethod: req.query.paymentMethod,
                        transactionType: req.query.transactionType,
                        createdFrom: req.query.createdFrom,
                        createdTo: req.query.createdTo,
                  }),
            );

            const payments = await getPaymentsService({
                  ...filters,
                  pagination,
            });

            res.status(200).json({
                  success: true,
                  count: payments.length,
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

// DELETE /payments/:paymentId – cleanup-only, Administrator only
export const deletePaymentCleanupController = async (
      req: Request,
      res: Response,
) => {
      try {
            await deletePaymentCleanupService(
                  req.params.paymentId as string,
                  req.auth!.employeeId,
            );

            res.status(204).json();
      } catch (error: any) {
            logger.error("Failed to cleanup-delete payment", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /reservations/:reservationId/overpayment-approvals – BR-053 approvals
export const getOverpaymentApprovalsController = async (
      req: Request,
      res: Response,
) => {
      try {
            const overpaymentApprovals = await getOverpaymentApprovalsService(
                  req.params.reservationId as string,
            );

            res.status(200).json({
                  success: true,
                  count: overpaymentApprovals.length,
                  message: "Successfully fetched overpayment approvals",
                  overpaymentApprovals,
            });
      } catch (error: any) {
            logger.error("Failed to fetch overpayment approvals", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// POST /reservations/:reservationId/overpayment-approvals – Administrator authorizes an overpayment
export const createOverpaymentApprovalController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as CreateOverpaymentApprovalDTO;
            const overpaymentApprovals = await createOverpaymentApprovalService(
                  req.params.reservationId as string,
                  { ...data, employeeId: req.auth!.employeeId },
            );

            res.status(201).json({
                  success: true,
                  message: "Successfully approved overpayment",
                  overpaymentApprovals,
            });
      } catch (error: any) {
            logger.error("Failed to create overpayment approval", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// PATCH /overpayment-approvals/:approvalId/revoke – Administrator revokes an unused approval
export const revokeOverpaymentApprovalController = async (
      req: Request,
      res: Response,
) => {
      try {
            const overpaymentApprovals = await revokeOverpaymentApprovalService(
                  req.params.approvalId as string,
                  req.auth!.employeeId,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully revoked overpayment approval",
                  overpaymentApprovals,
            });
      } catch (error: any) {
            logger.error("Failed to revoke overpayment approval", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
