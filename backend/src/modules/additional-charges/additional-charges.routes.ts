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
      AddChargeCorrectionSchema,
} from "./repository/additional-charge.schema";
import { validateBody, requireUuidParam } from "../../utils/http";
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

// Catalog: Administrator-managed configuration; reads open to all.
router.get("/additional-charge-catalog", getCatalogItemsController); // Checked
router.get(
      "/additional-charge-catalog/:catalogId",
      requireUuidParam("catalogId"),
      getCatalogItemByIdController,
); // Checked
router.post(
      "/additional-charge-catalog",
      authorizeRoles("Administrator"),
      validateBody(CreateCatalogItemSchema),
      createCatalogItemController,
); // Checked
router.patch(
      "/additional-charge-catalog/:catalogId/status",
      authorizeRoles("Administrator"),
      requireUuidParam("catalogId"),
      validateBody(UpdateCatalogItemSchema),
      updateCatalogItemController,
); // Checked
router.patch(
      "/additional-charge-catalog/:catalogId",
      authorizeRoles("Administrator"),
      requireUuidParam("catalogId"),
      validateBody(UpdateCatalogItemSchema),
      updateCatalogItemController,
); // Checked
router.delete(
      "/additional-charge-catalog/:catalogId",
      authorizeRoles("Administrator"),
      requireUuidParam("catalogId"),
      deleteCatalogItemController,
); // Checked

// Staff catalog application
router.post(
      "/reservations/:reservationId/charges",
      authorizeRoles("Staff"),
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
      authorizeRoles("Staff"),
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
      authorizeRoles("Administrator"),
      requireUuidParam("requestId"),
      validateBody(ApproveChargeRequestSchema),
      approveChargeRequestController,
); // Checked
router.patch(
      "/additional-charge-requests/:requestId/reject",
      authorizeRoles("Administrator"),
      requireUuidParam("requestId"),
      validateBody(RejectChargeRequestSchema),
      rejectChargeRequestController,
); // Checked
router.patch(
      "/additional-charge-requests/:requestId/withdraw",
      authorizeRoles("Staff"),
      requireUuidParam("requestId"),
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
      authorizeRoles("Staff"),
      requireUuidParam("chargeId"),
      deleteChargeController,
); // Checked
router.post(
      "/additional-charges/:chargeId/corrections",
      authorizeRoles("Administrator"),
      requireUuidParam("chargeId"),
      validateBody(AddChargeCorrectionSchema),
      addChargeCorrectionController,
); // Checked

export default router;
