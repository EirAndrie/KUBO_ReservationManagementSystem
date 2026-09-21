import { Router } from "express";
import {
      createPaymentController,
      getPaymentsByReservationController,
      getPaymentByIdController,
      updatePaymentController,
      deletePaymentController,
      searchPaymentsController,
      refundPaymentController,
} from "./payment.controllers";
import { CreatePaymentSchema, UpdatePaymentSchema } from "./repository/payment.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

// Payments scoped under a reservation
router.post(
      "/reservations/:reservationId/payments",
      validateBody(CreatePaymentSchema),
      createPaymentController,
);
router.get(
      "/reservations/:reservationId/payments",
      getPaymentsByReservationController,
);
router.post(
      "/reservations/:reservationId/payments/refund",
      // Body may omit reservationId and transactionType – validation can be same schema or a custom one; using CreatePaymentSchema for simplicity
      validateBody(CreatePaymentSchema),
      refundPaymentController,
);

// Direct payment routes
router.get("/payments/:paymentId", requireUuidParam("paymentId"), getPaymentByIdController);
router.patch(
      "/payments/:paymentId",
      requireUuidParam("paymentId"),
      validateBody(UpdatePaymentSchema),
      updatePaymentController,
);
router.delete(
      "/payments/:paymentId",
      requireUuidParam("paymentId"),
      deletePaymentController,
);
router.get("/payments", searchPaymentsController);

export default router;
