import {
      createPayment,
      getPaymentsByReservation,
      getPaymentById,
      updatePaymentStatus,
      recordRefund,
      recordChargeAdjustment,
      reverseChargeAdjustment,
      getPayments,
      deletePaymentCleanup,
} from "./repository/payment.repository";
import { AppError } from "../../utils/http";
import type {
      CreatePaymentDTO,
      RefundPaymentDTO,
      CreateChargeAdjustmentDTO,
      ReverseChargeAdjustmentDTO,
      UpdatePaymentStatusDTO,
      WithActor,
} from "./repository/payment.schema";
import type { Pagination } from "../../utils/pagination";

export const createPaymentService = async (
      reservationId: string,
      data: WithActor<CreatePaymentDTO>,
) => {
      return createPayment(reservationId, data);
};

export const getPaymentsByReservationService = async (
      reservationId: string,
) => {
      return getPaymentsByReservation(reservationId);
};

export const getPaymentByIdService = async (paymentId: string) => {
      const payment = await getPaymentById(paymentId);
      if (!payment) {
            throw new AppError(404, "Payment not found");
      }
      return payment;
};

export const updatePaymentStatusService = async (
      paymentId: string,
      data: WithActor<UpdatePaymentStatusDTO>,
) => {
      const payment = await getPaymentById(paymentId);
      if (!payment) {
            throw new AppError(404, "Payment not found");
      }
      return updatePaymentStatus(paymentId, data);
};

export const refundPaymentService = async (
      reservationId: string,
      data: WithActor<RefundPaymentDTO>,
) => {
      return recordRefund(reservationId, data);
};

/**
 * Applies an Administrator's non-cash reduction to one applied charge.
 * The database enforces the role, charge ownership, remaining reducible amount,
 * audit write, and atomic balance-ledger insert.
 */
export const createChargeAdjustmentService = async (
      reservationId: string,
      data: WithActor<CreateChargeAdjustmentDTO>,
) => recordChargeAdjustment(reservationId, data);

/**
 * Appends a partial or full reversal of an earlier charge Adjustment.
 * Actual cash returned to a guest remains a Staff Refund operation.
 */
export const reverseChargeAdjustmentService = async (
      reservationId: string,
      adjustmentPaymentId: string,
      data: WithActor<ReverseChargeAdjustmentDTO>,
) => reverseChargeAdjustment(reservationId, adjustmentPaymentId, data);

export const getPaymentsService = async (params: {
      reservationId?: string;
      employeeId?: string;
      paymentStatus?: string;
      paymentMethod?: string;
      transactionType?: string;
      createdFrom?: Date;
      createdTo?: Date;
      pagination: Pagination;
}) => {
      return getPayments({
            reservationId: params.reservationId,
            employeeId: params.employeeId,
            paymentStatus: params.paymentStatus,
            paymentMethod: params.paymentMethod,
            transactionType: params.transactionType,
            createdFrom: params.createdFrom,
            createdTo: params.createdTo,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};

export const deletePaymentCleanupService = async (
      paymentId: string,
      employeeId: string,
) => {
      const payment = await getPaymentById(paymentId);
      if (!payment) {
            throw new AppError(404, "Payment not found");
      }

      const deleted = await deletePaymentCleanup(paymentId, employeeId);
      if (!deleted) {
            throw new AppError(404, "Payment not found");
      }
};
