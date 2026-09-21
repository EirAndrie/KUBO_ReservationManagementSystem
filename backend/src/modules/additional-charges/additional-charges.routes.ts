import { Router } from "express";
import {
      createAdditionalChargeController,
      getChargesByReservationController,
      getAdditionalChargeByIdController,
      updateAdditionalChargeController,
      deleteAdditionalChargeController,
      searchAdditionalChargesController,
} from "./additional-charges.controllers";
import {
      CreateAdditionalChargeSchema,
      UpdateAdditionalChargeSchema,
} from "./repository/additional-charge.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

// Charges scoped under a reservation
router.post(
      "/reservations/:reservationId/charges",
      validateBody(CreateAdditionalChargeSchema),
      createAdditionalChargeController,
);
router.get(
      "/reservations/:reservationId/charges",
      getChargesByReservationController,
);

// Direct charge routes
router.get(
      "/charges/:chargeId",
      requireUuidParam("chargeId"),
      getAdditionalChargeByIdController,
);
router.patch(
      "/charges/:chargeId",
      requireUuidParam("chargeId"),
      validateBody(UpdateAdditionalChargeSchema),
      updateAdditionalChargeController,
);
router.delete(
      "/charges/:chargeId",
      requireUuidParam("chargeId"),
      deleteAdditionalChargeController,
);
router.get("/charges", searchAdditionalChargesController);

export default router;
