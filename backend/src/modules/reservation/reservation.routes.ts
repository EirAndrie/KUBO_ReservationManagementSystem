import { Router } from "express";
import {
      createReservationController,
      getAllReservationsController,
      getReservationByIdController,
      updateReservationController,
      confirmReservationController,
      cancelReservationController,
      markReservationNoShowController,
      deleteReservationController,
} from "./reservation.controllers";
import {
      CreateReservationSchema,
      UpdateReservationSchema,
      CancelReservationSchema,
} from "./repository/reservation.schema";
import { validateBody, requireUuidParam } from "../../utils/http";
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

// Reservation lifecycle operations are Staff-only (BR-005). Reads are open to
// any authenticated employee (Administrators review reservations read-only).
router.post(
      "/",
      authorizeRoles("staff"),
      validateBody(CreateReservationSchema),
      createReservationController,
);
router.get("/", getAllReservationsController);
router.get(
      "/:reservationId",
      requireUuidParam("reservationId"),
      getReservationByIdController,
);
router.patch(
      "/:reservationId",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      validateBody(UpdateReservationSchema),
      updateReservationController,
);
router.patch(
      "/:reservationId/confirm",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      confirmReservationController,
);
router.patch(
      "/:reservationId/cancel",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      validateBody(CancelReservationSchema),
      cancelReservationController,
);
router.patch(
      "/:reservationId/no-show",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      markReservationNoShowController,
);
// Repair-only action; normal operations use cancellation.
router.delete(
      "/:reservationId",
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      deleteReservationController,
);

export default router;
