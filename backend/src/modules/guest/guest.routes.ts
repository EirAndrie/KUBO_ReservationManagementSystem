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
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

router.post(
      "/",
      authorizeRoles("staff"),
      validateBody(CreateGuestSchema),
      createGuestController,
);
router.get("/", getAllGuestsController);
router.get("/:guestId", requireUuidParam("guestId"), getGuestByIdController);
router.patch(
      "/:guestId",
      authorizeRoles("staff"),
      requireUuidParam("guestId"),
      validateBody(UpdateGuestSchema),
      updateGuestController,
);
// Deletion is an Administrator-only administrative action.
router.delete(
      "/:guestId",
      authorizeRoles("administrator"),
      requireUuidParam("guestId"),
      deleteGuestController,
);

export default router;
