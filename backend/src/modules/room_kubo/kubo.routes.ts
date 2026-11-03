import { Router } from "express";
import {
      createKuboController,
      getAllKubosController,
      getKuboByIdController,
      updateKuboController,
      changeKuboStatusController,
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
      authorizeRoles("Administrator"),
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
      authorizeRoles("Administrator"),
      requireUuidParam("kuboId"),
      validateBody(ChangeKuboStatusSchema),
      changeKuboStatusController,
);
router.patch(
      "/:kuboId",
      authorizeRoles("Administrator"),
      requireUuidParam("kuboId"),
      validateBody(UpdateKuboSchema),
      updateKuboController,
);
router.delete(
      "/:kuboId",
      authorizeRoles("Administrator"),
      requireUuidParam("kuboId"),
      deleteKuboController,
);

export default router;
