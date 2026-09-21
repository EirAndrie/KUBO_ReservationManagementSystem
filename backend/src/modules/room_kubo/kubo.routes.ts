import { Router } from "express";
import {
      createRoomController,
      getAllRoomsController,
      getRoomByIdController,
      updateRoomController,
      deleteRoomController,
      getRoomsByTypeController,
} from "./kubo.controllers";
import { CreateKuboSchema, UpdateKuboSchema } from "./repository/kubo.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

router.post("/", validateBody(CreateKuboSchema), createRoomController);
router.get("/", getAllRoomsController);
router.get("/:roomId", requireUuidParam("roomId"), getRoomByIdController);
router.patch(
      "/:roomId",
      requireUuidParam("roomId"),
      validateBody(UpdateKuboSchema),
      updateRoomController,
);
router.delete("/:roomId", requireUuidParam("roomId"), deleteRoomController);
router.get(
      "/room-types/:roomTypeId/rooms",
      requireUuidParam("roomTypeId"),
      getRoomsByTypeController,
);

export default router;
