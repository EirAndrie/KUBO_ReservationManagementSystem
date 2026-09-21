import type { Request, Response, NextFunction } from "express";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      getAuditLogByIdService,
      searchAuditLogsService,
} from "./audit-logs.services";

// GET /audit-logs/:auditId – single log
export const getAuditLogByIdController = async (
      req: Request,
      res: Response,
      next: NextFunction,
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

// GET /audit-logs – filtered list (including employee-specific via query)
export const searchAuditLogsController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const pagination = getPagination(req.query);

            const employeeId =
                  typeof req.query.employeeId === "string"
                        ? req.query.employeeId
                        : undefined;
            const action =
                  typeof req.query.action === "string"
                        ? req.query.action
                        : undefined;
            const entityType =
                  typeof req.query.entityType === "string"
                        ? req.query.entityType
                        : undefined;
            const entityId =
                  typeof req.query.entityId === "string"
                        ? req.query.entityId
                        : undefined;
            const createdFrom =
                  typeof req.query.createdFrom === "string"
                        ? req.query.createdFrom
                        : undefined;
            const createdTo =
                  typeof req.query.createdTo === "string"
                        ? req.query.createdTo
                        : undefined;

            const auditLogs = await searchAuditLogsService({
                  employeeId,
                  action,
                  entityType,
                  entityId,
                  createdFrom,
                  createdTo,
                  pagination,
            });

            res.status(200).json({
                  success: true,
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

// GET /employees/:employeeId/audit-logs – same as search but forces employeeId
export const getAuditLogsByEmployeeController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const pagination = getPagination(req.query);

            const action =
                  typeof req.query.action === "string"
                        ? req.query.action
                        : undefined;
            const entityType =
                  typeof req.query.entityType === "string"
                        ? req.query.entityType
                        : undefined;

            const auditLogs = await searchAuditLogsService({
                  employeeId: req.params.employeeId as string,
                  action,
                  entityType,
                  pagination,
            });

            res.status(200).json({
                  success: true,
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
