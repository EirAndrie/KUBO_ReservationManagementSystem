import { Router } from "express";
import {
      getAuditLogByIdController,
      searchAuditLogsController,
      getAuditLogsByEmployeeController,
      getAuditHistoryController,
} from "./audit-logs.controllers";
import { requireUuidParam } from "../../utils/http";
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

// Audit-log review is Administrator-only (BR-005 permission matrix).
router.use(authorizeRoles("administrator"));

// General audit log endpoints
router.get("/", searchAuditLogsController);
router.get(
      "/history/:entityType/:entityId",
      requireUuidParam("entityId"),
      getAuditHistoryController,
);
router.get("/:auditId", requireUuidParam("auditId"), getAuditLogByIdController);

// Employee scoped logs
router.get(
      "/employees/:employeeId/audit-logs",
      requireUuidParam("employeeId"),
      getAuditLogsByEmployeeController,
);

export default router;
