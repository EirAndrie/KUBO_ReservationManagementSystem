import type {
      CreateReservedKuboDTO,
      UpdateReservedKuboDTO,
      ReservedKuboSchema,
} from "./reserved-kubo.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

// Assign a room to a reservation (create)
export const assignRoom = async (data: CreateReservedKuboDTO) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.assign_room_to_reservation(
                              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                        )
                  `,
                  [
                        data.reservationId,
                        data.kuboId,
                        data.checkInDate,
                        data.checkOutDate,
                        data.scheduledCheckInTime,
                        data.scheduledCheckOutTime,
                        data.priceAtBooking,
                        data.reservedKuboStatus,
                        data.earlyCheckInApproved,
                        // actual dates are null on creation
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to assign room to reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to assign room to reservation");
      }
};

// Get all rooms for a reservation
export const getRoomsByReservation = async (reservationId: string) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_rooms_by_reservation($1)
                  `,
                  [reservationId],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch rooms for reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to fetch rooms for reservation");
      }
};

// Get a specific reserved room (by reservationId + kuboId)
export const getReservedRoom = async (
      reservationId: string,
      kuboId: string,
) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_reserved_room($1, $2)
                  `,
                  [reservationId, kuboId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to get reserved room");
      }
};

// Update a reserved room
export const updateReservedRoom = async (data: UpdateReservedKuboDTO) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_reserved_room(
                              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
                        )
                  `,
                  [
                        data.reservationId,
                        data.kuboId,
                        data.checkInDate ?? null,
                        data.checkOutDate ?? null,
                        data.scheduledCheckInTime ?? null,
                        data.scheduledCheckOutTime ?? null,
                        data.actualCheckInDateTime ?? null,
                        data.actualCheckOutDateTime ?? null,
                        data.earlyCheckInApproved ?? null,
                        data.priceAtBooking ?? null,
                        data.reservedKuboStatus ?? null,
                        // any other fields omitted intentionally
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to update reserved room");
      }
};

// Delete a reserved room assignment
export const deleteReservedRoom = async (
      reservationId: string,
      kuboId: string,
) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT kubo.delete_reserved_room($1, $2) AS deleted
                  `,
                  [reservationId, kuboId],
            );
            return result.rows[0]?.deleted != null;
      } catch (error: any) {
            logger.error("Failed to delete reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to delete reserved room");
      }
};

// Check‑in a reserved room (set actualCheckInDateTime & status)
export const checkInRoom = async (reservationId: string, kuboId: string) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.checkin_reserved_room($1, $2)
                  `,
                  [reservationId, kuboId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to check‑in reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to check‑in reserved room");
      }
};

// Check‑out a reserved room
export const checkOutRoom = async (reservationId: string, kuboId: string) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.checkout_reserved_room($1, $2)
                  `,
                  [reservationId, kuboId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to check‑out reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to check‑out reserved room");
      }
};

// Approve early check‑in
export const approveEarlyCheckIn = async (
      reservationId: string,
      kuboId: string,
) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.approve_early_checkin($1, $2)
                  `,
                  [reservationId, kuboId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to approve early check‑in", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to approve early check‑in");
      }
};

// Search reserved rooms with filters & pagination
export const searchReservedRooms = async (params: {
      roomId?: string;
      status?: string;
      checkInDate?: string;
      checkOutDate?: string;
      pagination: { limit: number; offset: number };
}) => {
      const { roomId, status, checkInDate, checkOutDate, pagination } = params;
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_reserved_rooms(
                              $1, $2, $3, $4, $5, $6
                        )
                  `,
                  [
                        roomId ?? null,
                        status ?? null,
                        checkInDate ?? null,
                        checkOutDate ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search reserved rooms", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to search reserved rooms");
      }
};

// Get reservations for a specific room within a date range
export const getReservationsByRoom = async (
      roomId: string,
      checkInDate?: string,
      checkOutDate?: string,
) => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_reservations_by_room($1, $2, $3)
                  `,
                  [roomId, checkInDate ?? null, checkOutDate ?? null],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch reservations for room", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to fetch reservations for room");
      }
};
