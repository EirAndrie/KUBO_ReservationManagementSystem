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
      authorizeRoles("Staff"),
      validateBody(CreateGuestSchema),
      createGuestController,
);
router.get("/", getAllGuestsController);
router.get("/:guestId", requireUuidParam("guestId"), getGuestByIdController);
router.patch(
      "/:guestId",
      authorizeRoles("Staff"),
      requireUuidParam("guestId"),
      validateBody(UpdateGuestSchema),
      updateGuestController,
);
// Deletion is an Administrator-only administrative action.
router.delete(
      "/:guestId",
      authorizeRoles("Administrator"),
      requireUuidParam("guestId"),
      deleteGuestController,
);

export default router;
