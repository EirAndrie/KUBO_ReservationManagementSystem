import { Router } from "express";
import {
      createKuboController,
      getAllKubosController,
      getKuboByIdController,
      updateKuboController,
      changeKuboStatusController,
      markKuboReadyController,
      deleteKuboController,
      getKubosByTypeController,
      getAvailableKubosController,
} from "./kubo.controllers";
import {
      CreateKuboSchema,
      UpdateKuboSchema,
      ChangeKuboStatusSchema,
} from "./repository/kubo.schema";
import { validateBody, requireUuidParam } from "../../utils/http";
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

// Mutations and deletion are Administrator-only (BR-018).
router.post(
      "/",
      authorizeRoles("administrator"),
      validateBody(CreateKuboSchema),
      createKuboController,
);
router.get("/", getAllKubosController);
router.get("/available", getAvailableKubosController);
router.get(
      "/type/:kuboTypeId",
      requireUuidParam("kuboTypeId"),
      getKubosByTypeController,
);
router.get("/:kuboId", requireUuidParam("kuboId"), getKuboByIdController);
router.patch(
      "/:kuboId/status",
      authorizeRoles("administrator"),
      requireUuidParam("kuboId"),
      validateBody(ChangeKuboStatusSchema),
      changeKuboStatusController,
);
// Housekeeping (BR-021, BR-063): Staff return a cleaned kubo to service. Only
// Cleaning -> Available; other status changes stay on the Administrator route.
router.patch(
      "/:kuboId/ready",
      authorizeRoles("staff"),
      requireUuidParam("kuboId"),
      markKuboReadyController,
);
router.patch(
      "/:kuboId",
      authorizeRoles("administrator"),
      requireUuidParam("kuboId"),
      validateBody(UpdateKuboSchema),
      updateKuboController,
);
router.delete(
      "/:kuboId",
      authorizeRoles("administrator"),
      requireUuidParam("kuboId"),
      deleteKuboController,
);

export default router;
