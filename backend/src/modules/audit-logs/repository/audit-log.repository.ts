import type { AuditLogResponseDTO } from "./audit-log.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

/**
 * Retrieve a single audit log by its ID.
 */
export const getAuditLogById = async (
      auditLogId: string,
): Promise<AuditLogResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_audit_log_by_id($1)
                  `,
                  [auditLogId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get audit log by id", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to get audit log by id");
      }
};

/**
 * Search audit logs with optional filters and pagination.
 * All parameters are optional – the stored procedure should handle nulls.
 */
export const searchAuditLogs = async (params: {
      employeeId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      createdFrom?: string;
      createdTo?: string;
      pagination: { limit: number; offset: number };
}): Promise<AuditLogResponseDTO[]> => {
      const {
            employeeId,
            action,
            entityType,
            entityId,
            createdFrom,
            createdTo,
            pagination,
      } = params;
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_audit_logs(
                              $1, $2, $3, $4, $5, $6, $7, $8
                        )
                  `,
                  [
                        employeeId ?? null,
                        action ?? null,
                        entityType ?? null,
                        entityId ?? null,
                        createdFrom ?? null,
                        createdTo ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search audit logs", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(500, "Failed to search audit logs");
      }
};
