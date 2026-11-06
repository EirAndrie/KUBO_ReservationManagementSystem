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
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

router.post(
      "/",
      authorizeRoles("administrator"),
      validateBody(CreateKuboTypeSchema),
      createKuboTypeController,
);
router.get("/", getAllKuboTypesController);
router.get(
      "/:kuboTypeId",
      requireUuidParam("kuboTypeId"),
      getKuboTypeByIdController,
);
router.patch(
      "/:kuboTypeId",
      authorizeRoles("administrator"),
      requireUuidParam("kuboTypeId"),
      validateBody(UpdateKuboTypeSchema),
      updateKuboTypeController,
);
router.delete(
      "/:kuboTypeId",
      authorizeRoles("administrator"),
      requireUuidParam("kuboTypeId"),
      deleteKuboTypeController,
);

export default router;
