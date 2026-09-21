import {
      CreateGuestDTO,
      UpdateGuestDTO,
      GuestResponseDTO,
} from "./guest.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createGuest = async (
      data: CreateGuestDTO,
): Promise<GuestResponseDTO> => {
      try {
            const res = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.create_guest(
                              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                        )
                  `,
                  [
                        data.firstName,
                        data.lastName,
                        data.email,
                        data.phone,
                        data.addressLine1,
                        data.city,
                        data.stateProvince,
                        data.zidPostalCode,
                        data.country,
                        data.validIdType,
                        data.idNumber,
                  ],
            );
            return res.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert guest to the database", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(500, "Failed to insert guest to the database");
      }
};

export const getGuests = async (): Promise<GuestResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_guests()
                  `,
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch guests from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to fetch guests from database");
      }
};

export const getGuestById = async (
      guestId: string,
): Promise<GuestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_guest_by_id($1)
                  `,
                  [guestId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get guest by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to get guest by id from database");
      }
};

export const updateGuest = async (
      data: UpdateGuestDTO,
): Promise<GuestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_guest(
                              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                        )
                  `,
                  [
                        data.guestId,
                        data.firstName ?? null,
                        data.lastName ?? null,
                        data.email ?? null,
                        data.phone ?? null,
                        data.addressLine1 ?? null,
                        data.city ?? null,
                        data.stateProvince ?? null,
                        data.zidPostalCode ?? null,
                        data.country ?? null,
                        data.validIdType ?? null,
                        data.idNumber ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update guest in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to update guest in database");
      }
};

export const deleteGuest = async (guestId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT kubo.delete_guest($1) AS deleted
                  `,
                  [guestId],
            );
            return result.rows[0]?.deleted != null;
      } catch (error: any) {
            logger.error("Failed to delete guest from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to delete guest from database");
      }
};

export const searchGuests = async (params: {
      search?: string;
      validIdType?: string;
      pagination: { limit: number; offset: number };
}): Promise<GuestResponseDTO[]> => {
      const { search, validIdType, pagination } = params;
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_guests($1, $2, $3, $4)
                  `,
                  [
                        search ?? null,
                        validIdType ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search guests in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to search guests in database");
      }
};
