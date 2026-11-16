import { Router } from "express";
import { getDailyReportController } from "./report.controllers";
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

// Management reports are Administrator-only (BR-005).
router.use(authorizeRoles("administrator"));

router.get("/daily", getDailyReportController);

export default router;
