import type {
      CreateKuboTypeDTO,
      UpdateKuboTypeDTO,
      KuboTypeResponseDTO,
} from "./kubo-type.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createKuboType = async (
      data: CreateKuboTypeDTO,
): Promise<KuboTypeResponseDTO> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.create_kubo_type(
                              $1, $2, $3, $4
                        )
                  `,
                  [
                        data.kuboTypeName,
                        data.kuboTypeCapacity,
                        data.pricePerNight,
                        data.kuboTypeDescription,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert kubo type into database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to insert kubo type into database");
      }
};

export const getKuboTypes = async (): Promise<KuboTypeResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_kubo_types()
                  `,
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch kubo types from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to fetch kubo types from database");
      }
};

export const getKuboTypeById = async (
      kuboTypeId: string,
): Promise<KuboTypeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_kubo_type_by_id($1)
                  `,
                  [kuboTypeId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get kubo type by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(
                  500,
                  "Failed to get kubo type by id from database",
            );
      }
};

export const updateKuboType = async (
      data: UpdateKuboTypeDTO,
): Promise<KuboTypeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_kubo_type(
                              $1, $2, $3, $4, $5
                        )
                  `,
                  [
                        data.kuboTypeId,
                        data.kuboTypeName ?? null,
                        data.kuboTypeCapacity ?? null,
                        data.pricePerNight ?? null,
                        data.kuboTypeDescription ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update kubo type in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to update kubo type in database");
      }
};

export const deleteKuboType = async (kuboTypeId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT kubo.delete_kubo_type($1) AS deleted
                  `,
                  [kuboTypeId],
            );
            return result.rows[0]?.deleted != null;
      } catch (error: any) {
            logger.error("Failed to delete kubo type from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to delete kubo type from database");
      }
};

export const searchKuboTypes = async (params: {
      search?: string;
      minCapacity?: number;
      maxCapacity?: number;
      pagination: { limit: number; offset: number };
}): Promise<KuboTypeResponseDTO[]> => {
      const { search, minCapacity, maxCapacity, pagination } = params;
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_kubo_types($1, $2, $3, $4, $5)
                  `,
                  [
                        search ?? null,
                        minCapacity ?? null,
                        maxCapacity ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search kubo types in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) {
                  throw error;
            }
            throw new AppError(500, "Failed to search kubo types in database");
      }
};
