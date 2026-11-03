import type {
      CreateKuboTypeDTO,
      UpdateKuboTypeDTO,
      KuboTypeResponseDTO,
} from "./kubo-type.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createKuboType = async (
      data: CreateKuboTypeDTO,
      actorEmployeeId: string,
): Promise<KuboTypeResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_kubo_type_management.fn_create_kubo_type(
                        p_type_name => $1,
                        p_capacity => $2,
                        p_price_per_night => $3,
                        p_description => $4,
                        p_actor_employee_id => $5
                  )
                  `,
                  [
                        data.kuboTypeName,
                        data.kuboTypeCapacity,
                        data.pricePerNight,
                        data.kuboTypeDescription ?? null,
                        actorEmployeeId,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert kubo type into database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to insert kubo type into database",
            );
      }
};

export const getKuboTypes = async (params: {
      pagination: { limit: number; offset: number };
}): Promise<KuboTypeResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_kubo_type_management.fn_get_kubo_types(
                        p_limit => $1,
                        p_offset => $2
                  )
                  `,
                  [params.pagination.limit, params.pagination.offset],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch kubo types from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to fetch kubo types from database",
            );
      }
};

export const getKuboTypeById = async (
      kuboTypeId: string,
): Promise<KuboTypeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_kubo_type_management.fn_get_kubo_type_by_id($1)
                  `,
                  [kuboTypeId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get kubo type by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to get kubo type by id from database",
            );
      }
};

export const updateKuboType = async (
      kuboTypeId: string,
      data: UpdateKuboTypeDTO,
      actorEmployeeId: string,
): Promise<KuboTypeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_kubo_type_management.fn_update_kubo_type(
                        p_kubo_type_id => $1,
                        p_type_name => $2,
                        p_capacity => $3,
                        p_price_per_night => $4,
                        p_description => $5,
                        p_actor_employee_id => $6
                  )
                  `,
                  [
                        kuboTypeId,
                        data.kuboTypeName ?? null,
                        data.kuboTypeCapacity ?? null,
                        data.pricePerNight ?? null,
                        data.kuboTypeDescription ?? null,
                        actorEmployeeId,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update kubo type in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to update kubo type in database");
      }
};

export const deleteKuboType = async (
      kuboTypeId: string,
      actorEmployeeId: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_kubo_type_management.fn_delete_unused_kubo_type($1, $2) AS deleted
                  `,
                  [kuboTypeId, actorEmployeeId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete kubo type from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to delete kubo type from database");
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
                  SELECT *
                  FROM kubo_kubo_type_management.fn_get_kubo_types(
                        p_search => $1,
                        p_min_capacity => $2,
                        p_max_capacity => $3,
                        p_limit => $4,
                        p_offset => $5
                  )
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
            throw mapDatabaseError(
                  error,
                  "Failed to search kubo types in database",
            );
      }
};
