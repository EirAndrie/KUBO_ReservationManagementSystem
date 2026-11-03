import {
      createPayment,
      getPaymentsByReservation,
      getPaymentById,
      updatePaymentStatus,
      recordRefund,
      getPayments,
      deletePaymentCleanup,
} from "./repository/payment.repository";
import { AppError } from "../../utils/http";
import type {
      CreatePaymentDTO,
      RefundPaymentDTO,
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
