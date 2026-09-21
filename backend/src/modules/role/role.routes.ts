import { Router } from "express";
import {
      createRoleController,
      getAllRolesController,
      getRoleByIdController,
      updateRoleController,
      deleteRoleController,
} from "./role.controllers";
import { CreateRoleSchema, UpdateRoleSchema } from "./repository/role.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

router.post("/", validateBody(CreateRoleSchema), createRoleController);
router.get("/", getAllRolesController);
router.get("/:roleId", requireUuidParam("roleId"), getRoleByIdController);
router.patch(
      "/:roleId",
      requireUuidParam("roleId"),
      validateBody(UpdateRoleSchema),
      updateRoleController,
);
router.delete("/:roleId", requireUuidParam("roleId"), deleteRoleController);

export default router;
