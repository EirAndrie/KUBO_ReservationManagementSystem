import { Router } from "express";
import {
      getAllRolesController,
      getRoleByIdController,
      createRoleController,
      updateRoleController,
      deleteRoleController,
} from "./role.controller";

const router = Router();

// CRUD endpoints for Role
router.get("/", getAllRolesController);
router.get("/:id", getRoleByIdController);
router.post("/", createRoleController);
router.put("/:id", updateRoleController);
router.delete("/:id", deleteRoleController);

export default router;
