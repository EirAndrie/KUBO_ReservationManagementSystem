import { Router } from "express";
import {
      createPaymentController,
      getPaymentsByReservationController,
      getPaymentByIdController,
      updatePaymentStatusController,
      refundPaymentController,
      getPaymentsController,
      deletePaymentCleanupController,
} from "./payment.controllers";
import {
      CreatePaymentSchema,
      RefundPaymentSchema,
      UpdatePaymentStatusSchema,
} from "./repository/payment.schema";
import { validateBody, requireUuidParam } from "../../utils/http";
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

// Payments scoped under a reservation
router.post(
      "/reservations/:reservationId/payments",
      authorizeRoles("Staff"),
      requireUuidParam("reservationId"),
      validateBody(CreatePaymentSchema),
      createPaymentController,
); // Checked
router.get(
      "/reservations/:reservationId/payments",
      requireUuidParam("reservationId"),
      getPaymentsByReservationController,
); // Checked
router.post(
      "/reservations/:reservationId/payments/refund",
      authorizeRoles("Staff"),
      requireUuidParam("reservationId"),
      validateBody(RefundPaymentSchema),
      refundPaymentController,
); // Checked

// Direct payment routes
router.get("/payments", getPaymentsController); // Checked
router.get(
      "/payments/:paymentId",
      requireUuidParam("paymentId"),
      getPaymentByIdController,
); // Checked
router.patch(
      "/payments/:paymentId/status",
      authorizeRoles("Staff"),
      requireUuidParam("paymentId"),
      validateBody(UpdatePaymentStatusSchema),
      updatePaymentStatusController,
); // Checked
router.delete(
      "/payments/:paymentId",
      authorizeRoles("Administrator"),
      requireUuidParam("paymentId"),
      deletePaymentCleanupController,
); 

export default router;
