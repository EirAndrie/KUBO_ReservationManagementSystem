import { Router } from "express";
import roleRoutes from "../modules/role/role.routes";
import guestRoutes from "../modules/guest/guest.routes";
import kuboTypesRoutes from "./room_kubo-type/kubo-type.routes";
import employeeRoutes from "../modules/employee/employee.routes";
import reservationRoutes from "../modules/reservation/reservation.routes";
import reservedRoomsRoutes from "../modules/reserved-room_kubo/reserved-room_kubo.routes";
import paymentRoutes from "../modules/payment/payment.routes";
import additinalChargesRoutes from "../modules/additional-charges/additional-charges.routes";
import auditLogsRoutes from "../modules/audit-logs/audit-logs.routes";

const router = Router();

router.use("/roles", roleRoutes);
router.use("/guests", guestRoutes);
router.use("/kubo-types", kuboTypesRoutes);
router.use("/employees", employeeRoutes);
router.use("/reservations", reservationRoutes);
router.use("/resrved-rooms", reservedRoomsRoutes);
router.use("/payments", paymentRoutes);
router.use("/additional-charges", additinalChargesRoutes);
router.use("/audit-logs", auditLogsRoutes);

export default router;
