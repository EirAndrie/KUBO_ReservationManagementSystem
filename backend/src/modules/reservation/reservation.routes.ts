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

const router = Router();

router.post(
      "/",
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
      requireUuidParam("reservationId"),
      validateBody(UpdateReservationSchema),
      updateReservationController,
);
router.patch(
      "/:reservationId/confirm",
      requireUuidParam("reservationId"),
      confirmReservationController,
);
router.patch(
      "/:reservationId/cancel",
      requireUuidParam("reservationId"),
      validateBody(CancelReservationSchema),
      cancelReservationController,
);
router.patch(
      "/:reservationId/no-show",
      requireUuidParam("reservationId"),
      markReservationNoShowController,
);
// Repair-only action; normal operations use cancellation.
router.delete(
      "/:reservationId",
      requireUuidParam("reservationId"),
      deleteReservationController,
);

export default router;
