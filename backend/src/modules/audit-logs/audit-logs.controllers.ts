import type { Request, Response } from "express";
import {
      AppError,
      getPagination,
      getStringParam,
      handleControllerError,
} from "../../utils/http";
import logger from "../../utils/logger";
import {
      AuditLogFilterSchema,
      type AuditLogFilterDTO,
} from "./repository/audit-log.schema";
import {
      getAuditLogByIdService,
      searchAuditLogsService,
      getAuditHistoryService,
} from "./audit-logs.services";

const zodMessage = (error: any) =>
      error.issues
            .map((issue: any) =>
                  issue.path.length
                        ? `${issue.path.join(".")}: ${issue.message}`
                        : issue.message,
            )
            .join("; ");

const parseFilters = <T>(result: any): T => {
      if (!result.success) {
            throw new AppError(400, zodMessage(result.error));
      }
      return result.data as T;
};

// GET /audit-logs/:auditId – single log
export const getAuditLogByIdController = async (
      req: Request,
      res: Response,
) => {
      try {
            const auditLogs = await getAuditLogByIdService(
                  req.params.auditId as string,
            );
            res.status(200).json({
                  success: true,
                  message: "Successfully fetched Audit Log by its ID",
                  auditLogs,
            });
      } catch (error: any) {
            logger.error("Failed to get audit log by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /audit-logs – filtered list
export const searchAuditLogsController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);

            const filters = parseFilters<AuditLogFilterDTO>(
                  AuditLogFilterSchema.safeParse({
                        employeeId: req.query.employeeId,
                        action: req.query.action,
                        entityType: req.query.entityType,
                        entityId: req.query.entityId,
                        createdFrom: req.query.createdFrom,
                        createdTo: req.query.createdTo,
                  }),
            );

            const auditLogs = await searchAuditLogsService({
                  ...filters,
                  pagination,
            });

            res.status(200).json({
                  success: true,
                  count: auditLogs.length,
                  message: "Successfully fetched Audit Logs",
                  auditLogs,
            });
      } catch (error: any) {
            logger.error("Failed to search audit logs", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /audit-logs/history/:entityType/:entityId – entity history
export const getAuditHistoryController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);
            const entityType = getStringParam(
                  req.params.entityType,
                  "entityType",
            );
            const entityId = String(req.params.entityId);

            const auditLogs = await getAuditHistoryService({
                  entityType,
                  entityId,
                  pagination,
            });

            res.status(200).json({
                  success: true,
                  count: auditLogs.length,
                  message: "Successfully fetched Audit Log history",
                  auditLogs,
            });
      } catch (error: any) {
            logger.error("Failed to get audit history", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /employees/:employeeId/audit-logs – same as search but forces employeeId
export const getAuditLogsByEmployeeController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);

            const filters = parseFilters<AuditLogFilterDTO>(
                  AuditLogFilterSchema.safeParse({
                        action: req.query.action,
                        entityType: req.query.entityType,
                  }),
            );

            const auditLogs = await searchAuditLogsService({
                  employeeId: req.params.employeeId as string,
                  action: filters.action,
                  entityType: filters.entityType,
                  pagination,
            });

            res.status(200).json({
                  success: true,
                  count: auditLogs.length,
                  message: "Successfully fetched Audit Logs related to Employee",
                  auditLogs,
            });
      } catch (error: any) {
            logger.error("Failed to get audit logs for employee", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
