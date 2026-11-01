import { Router } from "express";
import {
      assignKuboController,
      getReservedKubosController,
      getReservedKuboController,
      updateReservedKuboController,
      deleteReservedKuboController,
      checkInReservedKuboController,
      checkOutReservedKuboController,
      approveEarlyCheckInController,
} from "./reserved-room_kubo.controllers";
import {
      CreateReservedKuboSchema,
      UpdateReservedKuboSchema,
} from "./repository/reserved-kubo.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

router.post(
      "/:reservationId/kubos",
      requireUuidParam("reservationId"),
      validateBody(CreateReservedKuboSchema),
      assignKuboController,
);
router.get(
      "/:reservationId/kubos",
      requireUuidParam("reservationId"),
      getReservedKubosController,
);
router.get(
      "/:reservationId/kubos/:kuboId",
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      getReservedKuboController,
);
router.patch(
      "/:reservationId/kubos/:kuboId",
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      validateBody(UpdateReservedKuboSchema),
      updateReservedKuboController,
);
router.delete(
      "/:reservationId/kubos/:kuboId",
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      deleteReservedKuboController,
);
router.patch(
      "/:reservationId/kubos/:kuboId/check-in",
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      checkInReservedKuboController,
);
router.patch(
      "/:reservationId/kubos/:kuboId/check-out",
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      checkOutReservedKuboController,
);
router.patch(
      "/:reservationId/kubos/:kuboId/early-check-in",
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      approveEarlyCheckInController,
);

export default router;
