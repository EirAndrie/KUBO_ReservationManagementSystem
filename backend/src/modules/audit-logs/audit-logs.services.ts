import {
      getAuditLogById,
      searchAuditLogs,
} from "./repository/audit-log.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type { Pagination } from "../../utils/pagination";

export const getAuditLogByIdService = async (auditLogId: string) => {
      const log = await getAuditLogById(auditLogId);
      if (!log) {
            throw new AppError(404, "Audit log not found");
      }
      return log;
};

export const searchAuditLogsService = async (params: {
      employeeId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      createdFrom?: string;
      createdTo?: string;
      pagination: Pagination;
}) => {
      return searchAuditLogs({
            employeeId: params.employeeId,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            createdFrom: params.createdFrom,
            createdTo: params.createdTo,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};
