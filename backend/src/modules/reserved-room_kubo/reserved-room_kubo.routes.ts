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
      markReservedKuboNoShowController,
      reassignReservedKuboController,
      getTimeFeesController,
      applyLateCheckOutFeeController,
} from "./reserved-room_kubo.controllers";
import {
      CreateReservedKuboSchema,
      UpdateReservedKuboSchema,
      ReassignReservedKuboSchema,
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
router.patch(
      "/:reservationId/kubos/:kuboId/no-show",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      markReservedKuboNoShowController,
);
router.patch(
      "/:reservationId/kubos/:kuboId/reassign",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      validateBody(ReassignReservedKuboSchema),
      reassignReservedKuboController,
);
router.get(
      "/:reservationId/kubos/:kuboId/time-fees",
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      getTimeFeesController,
);
router.post(
      "/:reservationId/kubos/:kuboId/late-check-out-fee",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      requireUuidParam("kuboId"),
      applyLateCheckOutFeeController,
);

export default router;
