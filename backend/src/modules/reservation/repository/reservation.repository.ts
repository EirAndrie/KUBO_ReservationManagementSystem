import type {
      CreateReservationDTO,
      UpdateReservationDTO,
      ReservationResponseDTO,
      WithActor,
} from "./reservation.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const buildAssignmentsPayload = (
      assignments: CreateReservationDTO["assignments"],
) =>
      JSON.stringify(
            assignments.map((assignment) => ({
                  kubo_id: assignment.kuboId,
                  check_in_date: toDateOnly(assignment.checkInDate),
                  check_out_date: toDateOnly(assignment.checkOutDate),
                  scheduled_check_in_time:
                        assignment.scheduledCheckInTime ?? null,
                  scheduled_check_out_time:
                        assignment.scheduledCheckOutTime ?? null,
            })),
      );

export const createReservation = async (
      data: WithActor<CreateReservationDTO>,
): Promise<ReservationResponseDTO> => {
      try {
            const created = await db.query(
                  `
                  SELECT kubo_reservation_management.fn_create_reservation(
                        $1,
                        $2,
                        $3::kubo.booking_source,
                        $4::jsonb
                  ) AS reservation_id
                  `,
                  [
                        data.guestId,
                        data.employeeId,
                        data.bookingSource,
                        buildAssignmentsPayload(data.assignments),
                  ],
            );

            const reservationId = created.rows[0]?.reservation_id;
            const reservation = await getReservationById(reservationId);
            if (!reservation) {
                  throw new Error("Created reservation could not be loaded.");
            }
            return reservation;
      } catch (error: any) {
            logger.error("Failed to insert reservation into database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to insert reservation into database",
            );
      }
};

export const getReservations = async (params: {
      status?: string;
      bookingSource?: string;
      search?: string;
      guestId?: string;
      employeeId?: string;
      checkInDate?: string;
      checkOutDate?: string;
      pagination: { limit: number; offset: number };
}): Promise<ReservationResponseDTO[]> => {
      const {
            status,
            bookingSource,
            search,
            guestId,
            employeeId,
            checkInDate,
            checkOutDate,
            pagination,
      } = params;
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_reservation_management.fn_get_reservations(
                        p_status => $1::kubo.reservation_status,
                        p_booking_source => $2::kubo.booking_source,
                        p_search => $3,
                        p_guest_id => $4,
                        p_employee_id => $5,
                        p_check_in_date => $6::date,
                        p_check_out_date => $7::date,
                        p_limit => $8,
                        p_offset => $9
                  )
                  `,
                  [
                        status ?? null,
                        bookingSource ?? null,
                        search ?? null,
                        guestId ?? null,
                        employeeId ?? null,
                        checkInDate ?? null,
                        checkOutDate ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch reservations from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to fetch reservations from database",
            );
      }
};

export const getReservationById = async (
      reservationId: string,
): Promise<ReservationResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_reservation_management.fn_get_reservation_by_id($1)
                  `,
                  [reservationId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get reservation by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to get reservation by id from database",
            );
      }
};

export const updateReservation = async (
      reservationId: string,
      data: WithActor<UpdateReservationDTO>,
): Promise<ReservationResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_update_reservation(
                        p_reservation_id => $1,
                        p_guest_id => $2,
                        p_booking_source => $3::kubo.booking_source,
                        p_actor_employee_id => $4
                  )
                  `,
                  [
                        reservationId,
                        data.guestId ?? null,
                        data.bookingSource ?? null,
                        data.employeeId,
                  ],
            );
            return getReservationById(reservationId);
      } catch (error: any) {
            logger.error("Failed to update reservation in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to update reservation in database",
            );
      }
};

export const confirmReservation = async (
      reservationId: string,
      employeeId: string,
): Promise<ReservationResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_confirm_reservation(
                        p_reservation_id => $1,
                        p_actor_employee_id => $2
                  )
                  `,
                  [reservationId, employeeId],
            );
            return getReservationById(reservationId);
      } catch (error: any) {
            logger.error("Failed to confirm reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to confirm reservation");
      }
};

export const cancelReservation = async (
      reservationId: string,
      reason: string,
      employeeId: string,
): Promise<ReservationResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_cancel_reservation(
                        p_reservation_id => $1,
                        p_reason => $2,
                        p_actor_employee_id => $3
                  )
                  `,
                  [reservationId, reason, employeeId],
            );
            return getReservationById(reservationId);
      } catch (error: any) {
            logger.error("Failed to cancel reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to cancel reservation");
      }
};

export const markReservationNoShow = async (
      reservationId: string,
      employeeId: string,
): Promise<ReservationResponseDTO | null> => {
      try {
            await db.query(
                  `
                  SELECT kubo_reservation_management.fn_mark_no_show(
                        p_reservation_id => $1,
                        p_actor_employee_id => $2
                  )
                  `,
                  [reservationId, employeeId],
            );
            return getReservationById(reservationId);
      } catch (error: any) {
            logger.error("Failed to mark reservation NoShow", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to mark reservation NoShow");
      }
};

export const deleteReservation = async (
      reservationId: string,
      employeeId: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_reservation_management.fn_delete_reservation(
                        p_reservation_id => $1,
                        p_actor_employee_id => $2
                  ) AS deleted
                  `,
                  [reservationId, employeeId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to delete reservation");
      }
};
