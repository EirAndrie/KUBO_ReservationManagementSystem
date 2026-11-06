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
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

// Assignment and check-in/check-out are Staff-only operations.
router.post(
      "/:reservationId/kubos",
      authorizeRoles("staff"),
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
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      validateBody(UpdateReservedKuboSchema),
      updateReservedKuboController,
);
router.delete(
      "/:reservationId/kubos/:kuboId",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      deleteReservedKuboController,
);
router.patch(
      "/:reservationId/kubos/:kuboId/check-in",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      checkInReservedKuboController,
);
router.patch(
      "/:reservationId/kubos/:kuboId/check-out",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      checkOutReservedKuboController,
);
router.patch(
      "/:reservationId/kubos/:kuboId/early-check-in",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      approveEarlyCheckInController,
);

export default router;
