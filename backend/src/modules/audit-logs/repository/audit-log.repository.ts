import type { AuditLogResponseDTO } from "./audit-log.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
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
            throw mapDatabaseError(error, "Failed to get audit log by id");
      }
};

/**
 * Search audit logs with optional filters and pagination.
 * All filter parameters are optional; nulls are passed through to the routine.
 */
export const searchAuditLogs = async (params: {
      employeeId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      createdFrom?: Date;
      createdTo?: Date;
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
                  SELECT *
                  FROM kubo.search_audit_logs(
                        p_employee_id => $1,
                        p_action => $2,
                        p_entity_type => $3,
                        p_entity_id => $4,
                        p_created_from => $5::timestamptz,
                        p_created_to => $6::timestamptz,
                        p_limit => $7,
                        p_offset => $8
                  )
                  `,
                  [
                        employeeId ?? null,
                        action ?? null,
                        entityType ?? null,
                        entityId ?? null,
                        createdFrom ? createdFrom.toISOString() : null,
                        createdTo ? createdTo.toISOString() : null,
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
            throw mapDatabaseError(error, "Failed to search audit logs");
      }
};

/**
 * Returns the audit history for one entity, such as an employee or role.
 *
 * Results are newest first and paginated in the database.
 */
export const getAuditHistory = async (params: {
      entityType: string;
      entityId: string;
      pagination: { limit: number; offset: number };
}): Promise<AuditLogResponseDTO[]> => {
      const { entityType, entityId, pagination } = params;
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo.get_audit_history($1, $2, $3, $4)
                  `,
                  [
                        entityType,
                        entityId,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to get audit history", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to get audit history");
      }
};
