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

const router = Router();

// Mutations and deletion are intended for Administrators; enforce once auth/RBAC exists.
router.post("/", validateBody(CreateKuboSchema), createKuboController);
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
      requireUuidParam("kuboId"),
      validateBody(ChangeKuboStatusSchema),
      changeKuboStatusController,
);
router.patch(
      "/:kuboId",
      requireUuidParam("kuboId"),
      validateBody(UpdateKuboSchema),
      updateKuboController,
);
router.delete("/:kuboId", requireUuidParam("kuboId"), deleteKuboController);

export default router;
