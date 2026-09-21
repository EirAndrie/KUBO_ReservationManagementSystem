import { Router } from "express";
import {
      createKuboTypeController,
      getAllKuboTypesController,
      getKuboTypeByIdController,
      updateKuboTypeController,
      deleteKuboTypeController,
} from "./kubo-type.controllers";
import {
      CreateKuboTypeSchema,
      UpdateKuboTypeSchema,
} from "./repository/kubo-type.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

router.post("/", validateBody(CreateKuboTypeSchema), createKuboTypeController);
router.get("/", getAllKuboTypesController);
router.get(
      "/:kuboTypeId",
      requireUuidParam("kuboTypeId"),
      getKuboTypeByIdController,
);
router.patch(
      "/:kuboTypeId",
      requireUuidParam("kuboTypeId"),
      validateBody(UpdateKuboTypeSchema),
      updateKuboTypeController,
);
router.delete(
      "/:kuboTypeId",
      requireUuidParam("kuboTypeId"),
      deleteKuboTypeController,
);

export default router;
