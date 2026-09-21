import { Router } from "express";
import roleRoutes from "../modules/role/role.routes";
import guestRoutes from "../modules/guest/guest.routes";
import kuboTypesRoutes from "../modules/room_kubo-type/kubo.routes";
import employeeRoutes from "../modules/employee/employee.routes";

const router = Router();

router.use("/roles", roleRoutes);
router.use("/guests", guestRoutes);
router.use("/kubo-types", kuboTypesRoutes);
router.use("/employees", employeeRoutes);

export default router;
