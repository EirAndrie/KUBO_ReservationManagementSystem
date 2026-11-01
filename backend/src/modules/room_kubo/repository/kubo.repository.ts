import type {
      CreateKuboDTO,
      UpdateKuboDTO,
      KuboResponseDTO,
} from "./kubo.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createKubo = async (
      data: CreateKuboDTO,
): Promise<KuboResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_management.fn_create_kubo(
                        p_number => $1,
                        p_type_id => $2,
                        p_status => $3::kubo.kubo_status
                  )
                  `,
                  [data.kuboNumber, data.kuboTypeId, data.status],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert kubo into database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to insert kubo into database",
            );
      }
};

export const getKubos = async (params: {
      pagination: { limit: number; offset: number };
}): Promise<KuboResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_management.fn_get_kubos(
                        p_limit => $1,
                        p_offset => $2
                  )
                  `,
                  [params.pagination.limit, params.pagination.offset],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch kubos from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to fetch kubos from database");
      }
};

export const getKuboById = async (
      kuboId: string,
): Promise<KuboResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_management.fn_get_kubo_by_id($1)
                  `,
                  [kuboId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get kubo by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to get kubo by id from database",
            );
      }
};

export const updateKubo = async (
      kuboId: string,
      data: UpdateKuboDTO,
): Promise<KuboResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_management.fn_update_kubo(
                        p_kubo_id => $1,
                        p_kubo_number => $2,
                        p_kubo_type_id => $3
                  )
                  `,
                  [
                        kuboId,
                        data.kuboNumber ?? null,
                        data.kuboTypeId ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update kubo in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to update kubo in database");
      }
};

export const changeKuboStatus = async (
      kuboId: string,
      status: string,
): Promise<KuboResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_management.fn_change_kubo_status(
                        p_kubo_id => $1,
                        p_status => $2::kubo.kubo_status
                  )
                  `,
                  [kuboId, status],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to change kubo status in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to change kubo status in database",
            );
      }
};

export const deleteKubo = async (kuboId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_management.fn_delete_unused_kubo($1) AS deleted
                  `,
                  [kuboId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete kubo from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to delete kubo from database");
      }
};

export const searchKubos = async (params: {
      search?: string;
      kuboTypeId?: string;
      status?: string;
      pagination: { limit: number; offset: number };
}): Promise<KuboResponseDTO[]> => {
      const { search, kuboTypeId, status, pagination } = params;
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_management.fn_get_kubos(
                        p_search => $1,
                        p_kubo_type_id => $2,
                        p_status => $3::kubo.kubo_status,
                        p_limit => $4,
                        p_offset => $5
                  )
                  `,
                  [
                        search ?? null,
                        kuboTypeId ?? null,
                        status ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search kubos in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to search kubos in database");
      }
};

export const getAvailableKubos = async (params: {
      checkIn: string;
      checkOut: string;
      kuboTypeId?: string;
}): Promise<KuboResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_management.fn_search_available_kubos(
                        p_check_in => $1::date,
                        p_check_out => $2::date,
                        p_kubo_type_id => $3
                  )
                  `,
                  [params.checkIn, params.checkOut, params.kuboTypeId ?? null],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch available kubos from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to fetch available kubos from database",
            );
      }
};
