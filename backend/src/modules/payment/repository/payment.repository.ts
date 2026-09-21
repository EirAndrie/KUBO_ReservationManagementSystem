import type {
      CreatePaymentDTO,
      UpdatePaymentDTO,
      PaymentResponseDTO,
} from "./payment.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

/**
 * Record a new payment (or refund when transactionType is set accordingly).
 */
export const createPayment = async (
      data: CreatePaymentDTO,
): Promise<PaymentResponseDTO> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.create_payment(
                              $1, $2, $3, $4, $5, $6, $7, $8
                        )
                  `,
                  [
                        data.reservationId,
                        data.employeeId,
                        data.paymentAmount,
                        data.transactionType,
                        data.paymentType,
                        data.paymentMethod,
                        data.paymentStatus,
                        data.paymentDate,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert payment into database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to insert payment into database");
      }
};

export const getPaymentsByReservation = async (
      reservationId: string,
): Promise<PaymentResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_payments_by_reservation($1)
                  `,
                  [reservationId],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch payments for reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to fetch payments for reservation");
      }
};

export const getPaymentById = async (
      paymentId: string,
): Promise<PaymentResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_payment_by_id($1)
                  `,
                  [paymentId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get payment by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to get payment by id from database",
            );
      }
};

export const updatePayment = async (
      data: UpdatePaymentDTO,
): Promise<PaymentResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_payment(
                              $1, $2, $3, $4, $5, $6, $7, $8, $9
                        )
                  `,
                  [
                        data.paymentId,
                        data.reservationId ?? null,
                        data.employeeId ?? null,
                        data.paymentAmount ?? null,
                        data.transactionType ?? null,
                        data.paymentType ?? null,
                        data.paymentMethod ?? null,
                        data.paymentStatus ?? null,
                        data.paymentDate ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update payment in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to update payment in database");
      }
};

export const deletePayment = async (paymentId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT kubo.delete_payment($1) AS deleted
                  `,
                  [paymentId],
            );
            return result.rows[0]?.deleted != null;
      } catch (error: any) {
            logger.error("Failed to delete payment from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to delete payment from database");
      }
};

/**
 * Search payments with optional filters and pagination.
 */
export const searchPayments = async (params: {
      reservationId?: string;
      employeeId?: string;
      paymentStatus?: string;
      paymentMethod?: string;
      pagination: { limit: number; offset: number };
}): Promise<PaymentResponseDTO[]> => {
      const {
            reservationId,
            employeeId,
            paymentStatus,
            paymentMethod,
            pagination,
      } = params;
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_payments(
                              $1, $2, $3, $4, $5, $6
                        )
                  `,
                  [
                        reservationId ?? null,
                        employeeId ?? null,
                        paymentStatus ?? null,
                        paymentMethod ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search payments in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to search payments in database");
      }
};

/**
 * Record a refund for a reservation. The caller provides the same fields as a payment
 * but the `transactionType` will be forced to `refund`.
 */
export const recordRefund = async (
      data: CreatePaymentDTO,
): Promise<PaymentResponseDTO> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.create_payment(
                              $1, $2, $3, $4, $5, $6, $7, $8
                        )
                  `,
                  [
                        data.reservationId,
                        data.employeeId,
                        data.paymentAmount,
                        "refund", // force transaction type
                        data.paymentType,
                        data.paymentMethod,
                        data.paymentStatus,
                        data.paymentDate,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to record refund in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to record refund in database");
      }
};
