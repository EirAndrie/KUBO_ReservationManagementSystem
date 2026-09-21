import type {
      CreateReservationDTO,
      UpdateReservationDTO,
      ReservationResponseDTO,
} from "./reservation.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createReservation = async (
      data: CreateReservationDTO,
): Promise<ReservationResponseDTO> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.create_reservation(
                              $1, $2, $3, $4, $5, $6, $7
                        )
                  `,
                  [
                        data.referenceCode,
                        data.reservationGuestId,
                        data.reservationEmployeeId,
                        data.reservationTotalAmount,
                        data.reservationStatus,
                        data.reservationBookingSource,
                        data.reservedAt,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert reservation into database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to insert reservation into database",
            );
      }
};

export const getReservations = async (): Promise<ReservationResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_reservations()
                  `,
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch reservations from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
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
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_reservation_by_id($1)
                  `,
                  [reservationId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get reservation by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to get reservation by id from database",
            );
      }
};

export const updateReservation = async (
      data: UpdateReservationDTO,
): Promise<ReservationResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_reservation(
                              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                        )
                  `,
                  [
                        data.reservationId,
                        data.referenceCode ?? null,
                        data.reservationGuestId ?? null,
                        data.reservationEmployeeId ?? null,
                        data.reservationTotalAmount ?? null,
                        data.reservationStatus ?? null,
                        data.reservationBookingSource ?? null,
                        data.reservedAt ?? null,
                        data.reservationCancelledAt ?? null,
                        data.cancellationReason ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update reservation in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to update reservation in database");
      }
};

export const deleteReservation = async (
      reservationId: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT kubo.delete_reservation($1) AS deleted
                  `,
                  [reservationId],
            );
            return result.rows[0]?.deleted != null;
      } catch (error: any) {
            logger.error("Failed to delete reservation from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to delete reservation from database",
            );
      }
};

export const searchReservations = async (params: {
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
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_reservations(
                              $1, $2, $3, $4, $5, $6, $7, $8, $9
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
            logger.error("Failed to search reservations in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to search reservations in database",
            );
      }
};

export const cancelReservation = async (
      reservationId: string,
      reason?: string,
): Promise<ReservationResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.cancel_reservation($1, $2)
                  `,
                  [reservationId, reason ?? null],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to cancel reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to cancel reservation");
      }
};

export const updateReservationStatus = async (
      reservationId: string,
      status: string,
): Promise<ReservationResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_reservation_status($1, $2)
                  `,
                  [reservationId, status],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update reservation status", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to update reservation status");
      }
};
