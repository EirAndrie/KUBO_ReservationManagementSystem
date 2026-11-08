import type {
      CreatePaymentDTO,
      RefundPaymentDTO,
      CreateChargeAdjustmentDTO,
      ReverseChargeAdjustmentDTO,
      UpdatePaymentStatusDTO,
      PaymentResponseDTO,
      WithActor,
} from "./payment.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const requirePaymentById = async (paymentId: string): Promise<PaymentResponseDTO> => {
      const payment = await getPaymentById(paymentId);
      if (!payment) {
            throw new Error("The payment transaction was not returned after saving.");
      }
      return payment;
};

export const createPayment = async (
      reservationId: string,
      data: WithActor<CreatePaymentDTO>,
): Promise<PaymentResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_payment_management.fn_create_payment(
                        p_reservation_id => $1,
                        p_employee_id => $2,
                        p_payment_amount => $3,
                        p_payment_type => $4::kubo.payment_type,
                        p_payment_method => $5::kubo.payment_method
                  )
                  `,
                  [
                        reservationId,
                        data.employeeId,
                        data.paymentAmount,
                        data.paymentType,
                        data.paymentMethod,
                  ],
            );
            return await requirePaymentById(result.rows[0].payment_id);
      } catch (error: any) {
            logger.error("Failed to insert payment into database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to insert payment into database",
            );
      }
};

export const getPaymentsByReservation = async (
      reservationId: string,
): Promise<PaymentResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_payment_management.fn_get_payment_details_by_reservation($1)
                  `,
                  [reservationId],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch reservation payments", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to fetch reservation payments");
      }
};

export const getPaymentById = async (
      paymentId: string,
): Promise<PaymentResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_payment_management.fn_get_payment_details_by_id($1)
                  `,
                  [paymentId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get payment by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to get payment by id from database",
            );
      }
};

export const updatePaymentStatus = async (
      paymentId: string,
      data: WithActor<UpdatePaymentStatusDTO>,
): Promise<PaymentResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_payment_management.fn_update_payment_status(
                        p_payment_id => $1,
                        p_employee_id => $2,
                        p_payment_status => $3::kubo.payment_status
                  )
                  `,
                  [paymentId, data.employeeId, data.status],
            );
            return result.rows[0]
                  ? await requirePaymentById(result.rows[0].payment_id)
                  : null;
      } catch (error: any) {
            logger.error("Failed to update payment status", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to update payment status");
      }
};

export const recordRefund = async (
      reservationId: string,
      data: WithActor<RefundPaymentDTO>,
): Promise<PaymentResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_payment_management.fn_record_refund(
                        p_reservation_id => $1,
                        p_employee_id => $2,
                        p_original_payment_id => $3,
                        p_payment_amount => $4,
                        p_payment_type => $5::kubo.payment_type,
                        p_payment_method => $6::kubo.payment_method
                  )
                  `,
                  [
                        reservationId,
                        data.employeeId,
                        data.originalPaymentId,
                        data.paymentAmount,
                        data.paymentType,
                        data.paymentMethod,
                  ],
            );
            return await requirePaymentById(result.rows[0].payment_id);
      } catch (error: any) {
            logger.error("Failed to record refund", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to record refund");
      }
};

export const getPayments = async (params: {
      reservationId?: string;
      employeeId?: string;
      paymentStatus?: string;
      paymentMethod?: string;
      transactionType?: string;
      createdFrom?: Date;
      createdTo?: Date;
      pagination: { limit: number; offset: number };
}): Promise<PaymentResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_payment_management.fn_get_payment_details(
                        p_reservation_id => $1,
                        p_employee_id => $2,
                        p_payment_status => $3::kubo.payment_status,
                        p_payment_method => $4::kubo.payment_method,
                        p_transaction_type => $5::kubo.transaction_type,
                        p_created_from => $6::date,
                        p_created_to => $7::date,
                        p_limit => $8,
                        p_offset => $9
                  )
                  `,
                  [
                        params.reservationId ?? null,
                        params.employeeId ?? null,
                        params.paymentStatus ?? null,
                        params.paymentMethod ?? null,
                        params.transactionType ?? null,
                        params.createdFrom
                              ? toDateOnly(params.createdFrom)
                              : null,
                        params.createdTo ? toDateOnly(params.createdTo) : null,
                        params.pagination.limit,
                        params.pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch payments", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to fetch payments");
      }
};

/**
 * Records an Administrator-only non-cash credit against one applied charge.
 * PostgreSQL locks the reservation and charge, enforces the remaining reducible
 * amount, inserts the ledger row, and writes the audit entry atomically.
 */
export const recordChargeAdjustment = async (
      reservationId: string,
      data: WithActor<CreateChargeAdjustmentDTO>,
): Promise<PaymentResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT details.*
                  FROM kubo_payment_management.fn_record_charge_adjustment(
                        p_reservation_id => $1,
                        p_charge_id => $2,
                        p_employee_id => $3,
                        p_payment_amount => $4,
                        p_description => $5
                  ) AS created(payment_id)
                  CROSS JOIN LATERAL
                        kubo_payment_management.fn_get_payment_details_by_id(
                              created.payment_id
                        ) AS details
                  `,
                  [
                        reservationId,
                        data.chargeId,
                        data.employeeId,
                        data.paymentAmount,
                        data.description,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to record charge adjustment", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to record charge adjustment");
      }
};

/**
 * Appends an Administrator reversal linked to an earlier charge Adjustment.
 * The database prevents reversing more than the un-reversed credit and audits
 * the new ledger row in the same transaction.
 */
export const reverseChargeAdjustment = async (
      reservationId: string,
      adjustmentPaymentId: string,
      data: WithActor<ReverseChargeAdjustmentDTO>,
): Promise<PaymentResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT details.*
                  FROM kubo_payment_management.fn_reverse_charge_adjustment(
                        p_reservation_id => $1,
                        p_adjustment_payment_id => $2,
                        p_employee_id => $3,
                        p_payment_amount => $4,
                        p_description => $5
                  ) AS created(payment_id)
                  CROSS JOIN LATERAL
                        kubo_payment_management.fn_get_payment_details_by_id(
                              created.payment_id
                        ) AS details
                  `,
                  [
                        reservationId,
                        adjustmentPaymentId,
                        data.employeeId,
                        data.paymentAmount,
                        data.description,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to reverse charge adjustment", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to reverse charge adjustment");
      }
};

/**
 * Cleanup-only deletion. Normal business operations must use refunds/reversals.
 */
export const deletePaymentCleanup = async (
      paymentId: string,
      employeeId: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_payment_management.fn_delete_payment_cleanup($1, $2) AS deleted
                  `,
                  [paymentId, employeeId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to cleanup-delete payment", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to cleanup-delete payment");
      }
};
