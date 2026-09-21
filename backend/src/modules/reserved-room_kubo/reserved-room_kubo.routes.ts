import { Router } from "express";
import {
      assignRoomController,
      getRoomsByReservationController,
      getReservedRoomController,
      updateReservedRoomController,
      deleteReservedRoomController,
      checkInRoomController,
      checkOutRoomController,
      earlyCheckInController,
      searchReservedRoomsController,
      getReservationsByRoomController,
} from "./reserved-room_kubo.controllers";
import {
      CreateReservedKuboSchema,
      UpdateReservedKuboSchema,
} from "./repository/reserved-kubo.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

// Assignment endpoints – nested under a reservation
router.post(
      "/reservations/:reservationId/rooms",
      validateBody(CreateReservedKuboSchema),
      assignRoomController,
);
router.get(
      "/reservations/:reservationId/rooms",
      getRoomsByReservationController,
);
router.get(
      "/reservations/:reservationId/rooms/:roomId",
      requireUuidParam("reservationId"),
      requireUuidParam("roomId"),
      getReservedRoomController,
);
router.patch(
      "/reservations/:reservationId/rooms/:roomId",
      requireUuidParam("reservationId"),
      requireUuidParam("roomId"),
      validateBody(UpdateReservedKuboSchema),
      updateReservedRoomController,
);
router.delete(
      "/reservations/:reservationId/rooms/:roomId",
      requireUuidParam("reservationId"),
      requireUuidParam("roomId"),
      deleteReservedRoomController,
);
router.patch(
      "/reservations/:reservationId/rooms/:roomId/check-in",
      requireUuidParam("reservationId"),
      requireUuidParam("roomId"),
      checkInRoomController,
);
router.patch(
      "/reservations/:reservationId/rooms/:roomId/check-out",
      requireUuidParam("reservationId"),
      requireUuidParam("roomId"),
      checkOutRoomController,
);
router.patch(
      "/reservations/:reservationId/rooms/:roomId/early-check-in",
      requireUuidParam("reservationId"),
      requireUuidParam("roomId"),
      earlyCheckInController,
);

// Public search endpoint for reserved rooms
router.get("/reserved-rooms", searchReservedRoomsController);

// Public endpoint to get reservations for a specific room
router.get(
      "/rooms/:roomId/reservations",
      requireUuidParam("roomId"),
      getReservationsByRoomController,
);

export default router;
