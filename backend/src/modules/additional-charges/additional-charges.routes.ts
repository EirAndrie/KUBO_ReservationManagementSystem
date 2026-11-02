import { Router } from "express";
import {
      createCatalogItemController,
      getCatalogItemsController,
      getCatalogItemByIdController,
      updateCatalogItemController,
      deleteCatalogItemController,
      applyCatalogChargeController,
      getChargesByReservationController,
      getChargeByIdController,
      getChargesController,
      deleteChargeController,
      addChargeCorrectionController,
      createChargeRequestController,
      getChargeRequestsController,
      getChargeRequestByIdController,
      approveChargeRequestController,
      rejectChargeRequestController,
      withdrawChargeRequestController,
} from "./additional-charges.controllers";
import {
      CreateCatalogItemSchema,
      UpdateCatalogItemSchema,
      ApplyCatalogChargeSchema,
      CustomChargeRequestSchema,
      ApproveChargeRequestSchema,
      RejectChargeRequestSchema,
      WithdrawChargeRequestSchema,
      AddChargeCorrectionSchema,
} from "./repository/additional-charge.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

// Catalog
router.get("/additional-charge-catalog", getCatalogItemsController); // Checked
router.get(
      "/additional-charge-catalog/:catalogId",
      requireUuidParam("catalogId"),
      getCatalogItemByIdController,
); // Checked
router.post(
      "/additional-charge-catalog",
      validateBody(CreateCatalogItemSchema),
      createCatalogItemController,
); // Checked
router.patch(
      "/additional-charge-catalog/:catalogId/status",
      requireUuidParam("catalogId"),
      validateBody(UpdateCatalogItemSchema),
      updateCatalogItemController,
); // Checked
router.patch(
      "/additional-charge-catalog/:catalogId",
      requireUuidParam("catalogId"),
      validateBody(UpdateCatalogItemSchema),
      updateCatalogItemController,
); // Checked
router.delete(
      "/additional-charge-catalog/:catalogId",
      requireUuidParam("catalogId"),
      deleteCatalogItemController,
); // Checked

// Staff catalog application
router.post(
      "/reservations/:reservationId/charges",
      requireUuidParam("reservationId"),
      validateBody(ApplyCatalogChargeSchema),
      applyCatalogChargeController,
); // Checked
router.get(
      "/reservations/:reservationId/charges",
      requireUuidParam("reservationId"),
      getChargesByReservationController,
); // Checked

// Staff custom requests
router.post(
      "/reservations/:reservationId/charge-requests",
      requireUuidParam("reservationId"),
      validateBody(CustomChargeRequestSchema),
      createChargeRequestController,
); // Checked

// Admin request review
router.get("/additional-charge-requests", getChargeRequestsController); // Checked
router.get(
      "/additional-charge-requests/:requestId",
      requireUuidParam("requestId"),
      getChargeRequestByIdController,
); // Checked
router.patch(
      "/additional-charge-requests/:requestId/approve",
      requireUuidParam("requestId"),
      validateBody(ApproveChargeRequestSchema),
      approveChargeRequestController,
); // Checked
router.patch(
      "/additional-charge-requests/:requestId/reject",
      requireUuidParam("requestId"),
      validateBody(RejectChargeRequestSchema),
      rejectChargeRequestController,
); // Checked
router.patch(
      "/additional-charge-requests/:requestId/withdraw",
      requireUuidParam("requestId"),
      validateBody(WithdrawChargeRequestSchema),
      withdrawChargeRequestController,
); // Checked

// Applied charges
router.get("/additional-charges", getChargesController); // Checked
router.get(
      "/additional-charges/:chargeId",
      requireUuidParam("chargeId"),
      getChargeByIdController,
); // Checked
router.delete(
      "/additional-charges/:chargeId",
      requireUuidParam("chargeId"),
      deleteChargeController,
);  // Checked
router.post(
      "/additional-charges/:chargeId/corrections",
      requireUuidParam("chargeId"),
      validateBody(AddChargeCorrectionSchema),
      addChargeCorrectionController,
); // Checked

export default router;
