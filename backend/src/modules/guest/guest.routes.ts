import { Router } from "express";
import {
      createGuestController,
      getAllGuestsController,
      getGuestByIdController,
      updateGuestController,
      deleteGuestController,
} from "./guest.controllers";
import { CreateGuestSchema, UpdateGuestSchema } from "./repository/guest.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

router.post("/", validateBody(CreateGuestSchema), createGuestController);
router.get("/", getAllGuestsController);
router.get("/:guestId", requireUuidParam("guestId"), getGuestByIdController);
router.patch(
      "/:guestId",
      requireUuidParam("guestId"),
      validateBody(UpdateGuestSchema),
      updateGuestController,
);
router.delete("/:guestId", requireUuidParam("guestId"), deleteGuestController);

export default router;
