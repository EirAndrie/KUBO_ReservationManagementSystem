import type {
      CreateReservedKuboDTO,
      UpdateReservedKuboDTO,
      ReservedKuboResponseDTO,
      WithActor,
} from "./reserved-kubo.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const getReservedKubos = async (
      reservationId: string,
): Promise<ReservedKuboResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_reservation_management.fn_get_reserved_kubos($1)
                  `,
                  [reservationId],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch reserved kubos", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to fetch reserved kubos");
      }
};

export const getReservedKubo = async (
      reservationId: string,
      kuboId: string,
): Promise<ReservedKuboResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_reservation_management.fn_get_reserved_kubo($1, $2)
                  `,
                  [reservationId, kuboId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to fetch reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to fetch reserved kubo");
      }
};

export const assignKubo = async (
      reservationId: string,
      data: WithActor<CreateReservedKuboDTO>,
): Promise<ReservedKuboResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_add_reserved_kubo(
                        p_reservation_id => $1,
                        p_kubo_id => $2,
                        p_check_in_date => $3::date,
                        p_check_out_date => $4::date,
                        p_scheduled_check_in_time => $5::time,
                        p_scheduled_check_out_time => $6::time,
                        p_actor_employee_id => $7
                  )
                  `,
                  [
                        reservationId,
                        data.kuboId,
                        toDateOnly(data.checkInDate),
                        toDateOnly(data.checkOutDate),
                        data.scheduledCheckInTime ?? null,
                        data.scheduledCheckOutTime ?? null,
                        data.employeeId,
                  ],
            );
            return getReservedKubo(reservationId, data.kuboId);
      } catch (error: any) {
            logger.error("Failed to assign kubo to reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to assign kubo to reservation",
            );
      }
};

export const updateReservedKubo = async (
      reservationId: string,
      kuboId: string,
      data: WithActor<UpdateReservedKuboDTO>,
): Promise<ReservedKuboResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_update_reserved_kubo(
                        p_reservation_id => $1,
                        p_kubo_id => $2,
                        p_check_in_date => $3::date,
                        p_check_out_date => $4::date,
                        p_scheduled_check_in_time => $5::time,
                        p_scheduled_check_out_time => $6::time,
                        p_actor_employee_id => $7
                  )
                  `,
                  [
                        reservationId,
                        kuboId,
                        data.checkInDate ? toDateOnly(data.checkInDate) : null,
                        data.checkOutDate ? toDateOnly(data.checkOutDate) : null,
                        data.scheduledCheckInTime ?? null,
                        data.scheduledCheckOutTime ?? null,
                        data.employeeId,
                  ],
            );
            return getReservedKubo(reservationId, kuboId);
      } catch (error: any) {
            logger.error("Failed to update reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to update reserved kubo");
      }
};

export const deleteReservedKubo = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_reservation_management.fn_delete_reserved_kubo(
                        p_reservation_id => $1,
                        p_kubo_id => $2,
                        p_actor_employee_id => $3
                  ) AS deleted
                  `,
                  [reservationId, kuboId, employeeId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to delete reserved kubo");
      }
};

export const checkInReservedKubo = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
): Promise<ReservedKuboResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_check_in_reserved_kubo(
                        p_reservation_id => $1,
                        p_kubo_id => $2,
                        p_actor_employee_id => $3
                  )
                  `,
                  [reservationId, kuboId, employeeId],
            );
            return getReservedKubo(reservationId, kuboId);
      } catch (error: any) {
            logger.error("Failed to check in reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to check in reserved kubo");
      }
};

export const checkOutReservedKubo = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
): Promise<ReservedKuboResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_check_out_reserved_kubo(
                        p_reservation_id => $1,
                        p_kubo_id => $2,
                        p_actor_employee_id => $3
                  )
                  `,
                  [reservationId, kuboId, employeeId],
            );
            return getReservedKubo(reservationId, kuboId);
      } catch (error: any) {
            logger.error("Failed to check out reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to check out reserved kubo");
      }
};

export const approveEarlyCheckIn = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
): Promise<ReservedKuboResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_approve_early_check_in(
                        p_reservation_id => $1,
                        p_kubo_id => $2,
                        p_actor_employee_id => $3
                  )
                  `,
                  [reservationId, kuboId, employeeId],
            );
            return getReservedKubo(reservationId, kuboId);
      } catch (error: any) {
            logger.error("Failed to approve early check-in", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to approve early check-in");
      }
};

export const markReservedKuboNoShow = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
): Promise<ReservedKuboResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_mark_reserved_kubo_no_show(
                        p_reservation_id => $1,
                        p_kubo_id => $2,
                        p_actor_employee_id => $3
                  )
                  `,
                  [reservationId, kuboId, employeeId],
            );
            return getReservedKubo(reservationId, kuboId);
      } catch (error: any) {
            logger.error("Failed to mark reserved kubo as no-show", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to mark reserved kubo as no-show");
      }
};

/**
 * Replaces a Reserved assignment with another kubo (same dates and scheduled
 * times) in one transaction via `fn_reassign_reserved_kubo`.
 *
 * Database side effects: adds the new assignment at the new kubo's current
 * rate, removes the old one, updates both kubos' statuses and writes audit rows.
 * Failure behavior: the database refuses an unavailable kubo, a non-Reserved
 * assignment, or a reservation that is not Pending/Confirmed; nothing changes.
 *
 * @returns the new assignment.
 */
export const reassignReservedKubo = async (
      reservationId: string,
      oldKuboId: string,
      newKuboId: string,
      employeeId: string,
): Promise<ReservedKuboResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_reassign_reserved_kubo(
                        p_reservation_id => $1,
                        p_old_kubo_id => $2,
                        p_new_kubo_id => $3,
                        p_actor_employee_id => $4
                  )
                  `,
                  [reservationId, oldKuboId, newKuboId, employeeId],
            );
            return getReservedKubo(reservationId, newKuboId);
      } catch (error: any) {
            logger.error("Failed to reassign reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to reassign reserved kubo");
      }
};
