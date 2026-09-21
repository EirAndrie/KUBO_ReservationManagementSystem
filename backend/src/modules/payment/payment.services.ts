import {
      createPayment,
      getPaymentsByReservation,
      getPaymentById,
      updatePayment,
      deletePayment,
      searchPayments,
      recordRefund,
} from "./repository/payment.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type { CreatePaymentDTO, UpdatePaymentDTO } from "./repository/payment.schema";
import type { Pagination } from "../../utils/pagination";

export const createPaymentService = async (data: CreatePaymentDTO) => {
      // No duplicate checks defined yet
      return createPayment(data);
};

export const getPaymentsByReservationService = async (reservationId: string) => {
      return getPaymentsByReservation(reservationId);
};

export const getPaymentByIdService = async (paymentId: string) => {
      const payment = await getPaymentById(paymentId);
      if (!payment) {
            throw new AppError(404, "Payment not found");
      }
      return payment;
};

export const updatePaymentService = async (data: UpdatePaymentDTO) => {
      const existing = await getPaymentById(data.paymentId);
      if (!existing) {
            throw new AppError(404, "Payment not found");
      }
      return updatePayment(data);
};

export const deletePaymentService = async (paymentId: string) => {
      const existing = await getPaymentById(paymentId);
      if (!existing) {
            throw new AppError(404, "Payment not found");
      }
      await deletePayment(paymentId);
};

export const searchPaymentsService = async (
      params: {
            reservationId?: string;
            employeeId?: string;
            paymentStatus?: string;
            paymentMethod?: string;
            pagination: Pagination;
      },
) => {
      return searchPayments({
            reservationId: params.reservationId,
            employeeId: params.employeeId,
            paymentStatus: params.paymentStatus,
            paymentMethod: params.paymentMethod,
            pagination: { limit: params.pagination.limit, offset: params.pagination.offset },
      });
};

export const refundPaymentService = async (reservationId: string, data: Omit<CreatePaymentDTO, "reservationId" | "transactionType">) => {
      // Build a CreatePaymentDTO with forced transactionType = refund
      const payload: CreatePaymentDTO = {
            reservationId,
            employeeId: data.employeeId,
            paymentAmount: data.paymentAmount,
            transactionType: "refund",
            paymentType: data.paymentType,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentStatus,
            paymentDate: data.paymentDate,
      };
      return recordRefund(payload);
};
