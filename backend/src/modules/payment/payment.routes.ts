import { Router } from "express";
import {
      createPaymentController,
      getPaymentsByReservationController,
      getPaymentByIdController,
      updatePaymentStatusController,
      refundPaymentController,
      createChargeAdjustmentController,
      reverseChargeAdjustmentController,
      getPaymentsController,
      deletePaymentCleanupController,
      getOverpaymentApprovalsController,
      createOverpaymentApprovalController,
      revokeOverpaymentApprovalController,
} from "./payment.controllers";
import {
      CreatePaymentSchema,
      RefundPaymentSchema,
      CreateChargeAdjustmentSchema,
      ReverseChargeAdjustmentSchema,
      UpdatePaymentStatusSchema,
      CreateOverpaymentApprovalSchema,
} from "./repository/payment.schema";
import { validateBody, requireUuidParam } from "../../utils/http";
import { authorizeRoles } from "../auth/auth.middleware";

const router = Router();

// Payments scoped under a reservation
router.post(
      "/reservations/:reservationId/payments/adjustments",
      authorizeRoles("administrator"),
      requireUuidParam("reservationId"),
      validateBody(CreateChargeAdjustmentSchema),
      createChargeAdjustmentController,
);
router.post(
      "/reservations/:reservationId/payments/adjustments/:adjustmentId/reversals",
      authorizeRoles("administrator"),
      requireUuidParam("reservationId"),
      requireUuidParam("adjustmentId"),
      validateBody(ReverseChargeAdjustmentSchema),
      reverseChargeAdjustmentController,
);
router.post(
      "/reservations/:reservationId/payments",
      authorizeRoles("staff"),
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
      authorizeRoles("staff"),
      requireUuidParam("reservationId"),
      validateBody(RefundPaymentSchema),
      refundPaymentController,
); // Checked

// BR-053 overpayment approvals: Administrators authorize, Staff record the payment.
router.get(
      "/reservations/:reservationId/overpayment-approvals",
      requireUuidParam("reservationId"),
      getOverpaymentApprovalsController,
);
router.post(
      "/reservations/:reservationId/overpayment-approvals",
      authorizeRoles("administrator"),
      requireUuidParam("reservationId"),
      validateBody(CreateOverpaymentApprovalSchema),
      createOverpaymentApprovalController,
);
router.patch(
      "/overpayment-approvals/:approvalId/revoke",
      authorizeRoles("administrator"),
      requireUuidParam("approvalId"),
      revokeOverpaymentApprovalController,
);

// Direct payment routes
router.get("/payments", getPaymentsController); // Checked
router.get(
      "/payments/:paymentId",
      requireUuidParam("paymentId"),
      getPaymentByIdController,
); // Checked
router.patch(
      "/payments/:paymentId/status",
      authorizeRoles("staff"),
      requireUuidParam("paymentId"),
      validateBody(UpdatePaymentStatusSchema),
      updatePaymentStatusController,
); // Checked
router.delete(
      "/payments/:paymentId",
      authorizeRoles("administrator"),
      requireUuidParam("paymentId"),
      deletePaymentCleanupController,
); 

export default router;
