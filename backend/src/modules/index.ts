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

const router = Router();

// Health check route
router.get("/health", async (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running",
        timestamp: new Date().toISOString(),
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
