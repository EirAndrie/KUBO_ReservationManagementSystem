import type {
      AuditLogResponseDTO,
      WriteAuditLogParams,
} from "./audit-log.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

/**
 * Writes a single audit row. Intended for events without their own database
 * mutation routine (login and logout), which call the shared
 * `kubo_audit_management.write_audit_log` routine directly.
 */
export const writeAuditLog = async (
      params: WriteAuditLogParams,
): Promise<void> => {
      try {
            await db.query(
                  `
                  SELECT kubo_audit_management.write_audit_log(
                        $1,
                        $2::kubo.audit_action,
                        $3,
                        $4,
                        $5,
                        $6::json,
                        $7::json
                  )
                  `,
                  [
                        params.employeeId,
                        params.action,
                        params.entityType,
                        params.entityId,
                        params.description ?? null,
                        params.oldValues
                              ? JSON.stringify(params.oldValues)
                              : null,
                        params.newValues
                              ? JSON.stringify(params.newValues)
                              : null,
                  ],
            );
      } catch (error: any) {
            logger.error("Failed to write audit log", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to write audit log");
      }
};

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
