import { Router } from "express";
import {
      createReservationController,
      getAllReservationsController,
      getReservationByIdController,
      updateReservationController,
      deleteReservationController,
      cancelReservationController,
      updateReservationStatusController,
} from "./reservation.controllers";
import {
      CreateReservationSchema,
      UpdateReservationSchema,
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
router.delete(
      "/:reservationId",
      requireUuidParam("reservationId"),
      deleteReservationController,
);
router.patch(
      "/:reservationId/cancel",
      requireUuidParam("reservationId"),
      cancelReservationController,
);
router.patch(
      "/:reservationId/status",
      requireUuidParam("reservationId"),
      updateReservationStatusController,
);

export default router;
