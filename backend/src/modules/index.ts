import { Router } from "express";
import roleRoutes from "../modules/role/role.routes";

const router = Router();

router.use("/role", roleRoutes);

export default router;
