import { Router } from "express";
import {
      getAuditLogByIdController,
      searchAuditLogsController,
      getAuditLogsByEmployeeController,
} from "./audit-logs.controllers";
import { requireUuidParam } from "../../utils/http";

const router = Router();

// General audit log endpoints
router.get("/", searchAuditLogsController);
router.get("/:auditId", requireUuidParam("auditId"), getAuditLogByIdController);

// Employee scoped logs
router.get(
      "/employees/:employeeId/audit-logs",
      requireUuidParam("employeeId"),
      getAuditLogsByEmployeeController,
);

export default router;
