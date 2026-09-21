import type {
      CreateKuboDTO,
      UpdateKuboDTO,
      KuboResponseDTO,
} from "./kubo.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createRoom = async (
      data: CreateKuboDTO,
): Promise<KuboResponseDTO> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.create_room(
                              $1, $2, $3
                        )
                  `,
                  [data.kuboTypeId, data.kuboRoomNumber, data.kuboStatus],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert room into database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to insert room into database");
      }
};

export const getRooms = async (): Promise<KuboResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_rooms()
                  `,
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch rooms from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to fetch rooms from database");
      }
};

export const getRoomById = async (
      roomId: string,
): Promise<KuboResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_room_by_id($1)
                  `,
                  [roomId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get room by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to get room by id from database");
      }
};

export const updateRoom = async (
      data: UpdateKuboDTO,
): Promise<KuboResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_room(
                              $1, $2, $3, $4
                        )
                  `,
                  [
                        data.kuboId,
                        data.kuboTypeId ?? null,
                        data.kuboRoomNumber ?? null,
                        data.kuboStatus ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update room in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to update room in database");
      }
};

export const deleteRoom = async (roomId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT kubo.delete_room($1) AS deleted
                  `,
                  [roomId],
            );
            return result.rows[0]?.deleted != null;
      } catch (error: any) {
            logger.error("Failed to delete room from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to delete room from database");
      }
};

export const searchRooms = async (params: {
      roomTypeId?: string;
      status?: string;
      search?: string;
      pagination: { limit: number; offset: number };
}): Promise<KuboResponseDTO[]> => {
      const { roomTypeId, status, search, pagination } = params;
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_rooms($1, $2, $3, $4, $5)
                  `,
                  [
                        roomTypeId ?? null,
                        status ?? null,
                        search ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search rooms in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to search rooms in database");
      }
};

export const getRoomsByType = async (
      roomTypeId: string,
): Promise<KuboResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_rooms_by_type($1)
                  `,
                  [roomTypeId],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to get rooms by type from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to get rooms by type from database",
            );
      }
};
