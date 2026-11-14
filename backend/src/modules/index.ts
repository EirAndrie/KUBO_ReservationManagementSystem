import { Router } from "express";
import roleRoutes from "../modules/role/role.routes";
import guestRoutes from "../modules/guest/guest.routes";
import kuboTypesRoutes from "./room_kubo-type/kubo-type.routes";
import kuboRoutes from "../modules/room_kubo/kubo.routes";
import employeeRoutes from "../modules/employee/employee.routes";
import reservationRoutes from "../modules/reservation/reservation.routes";
import reservedRoomsRoutes from "../modules/reserved-room_kubo/reserved-room_kubo.routes";
import paymentRoutes from "../modules/payment/payment.routes";
import additinalChargesRoutes from "../modules/additional-charges/additional-charges.routes";
import auditLogsRoutes from "../modules/audit-logs/audit-logs.routes";
import authRoutes from "./auth/auth.routes";
import { authenticate } from "./auth/auth.middleware";
import { db } from "../config/connectDB";
import logger from "../utils/logger";

const router = Router();

const HEALTH_DB_TIMEOUT_MS = 5000;

/**
 * Public health check used by the keep-alive workflow and hosting probes.
 * Returns 200 when the API can reach PostgreSQL and 503 (JSON, not a generic
 * 500) when the database is unreachable, so monitors can tell the API process
 * is up but its dependency is down.
 */
router.get("/health", async (_req, res) => {
    const timestamp = new Date().toISOString();

    let timer: NodeJS.Timeout | undefined;
    try {
        // The pool has no connection timeout, so bound the probe; an
        // unreachable host would otherwise hang the request.
        await Promise.race([
            db.query("SELECT 1"),
            new Promise((_resolve, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Database health probe timed out")),
                    HEALTH_DB_TIMEOUT_MS,
                );
            }),
        ]);
    } catch (error: any) {
        logger.error("Health check failed: database unreachable", {
            message: error?.message,
        });
        return res.status(503).json({
            success: false,
            message: "Database unavailable",
            database: "down",
            timestamp,
        });
    } finally {
        clearTimeout(timer);
    }

    res.status(200).json({
        success: true,
        message: "API is running",
        database: "up",
        timestamp,
    });
});

// Authentication is public; it is mounted before the global auth guard.
router.use("/auth", authRoutes);

// Every route below requires a valid, active access token.
router.use(authenticate);

router.use("/roles", roleRoutes);
router.use("/guests", guestRoutes);
router.use("/kubo-types", kuboTypesRoutes);
router.use("/kubos", kuboRoutes);
router.use("/employees", employeeRoutes);
router.use("/reservations", reservationRoutes);
router.use("/reservations", reservedRoomsRoutes);
router.use("/audit-logs", auditLogsRoutes);
router.use("/", paymentRoutes);
router.use("/", additinalChargesRoutes);

export default router;
