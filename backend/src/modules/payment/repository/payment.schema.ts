import { z } from "zod";

const TRANSACTION_TYPE = [
      "payment",
      "refund",
      "adjsutment",
      "reversal",
] as const;

const PAYMENT_TYPE = [
      "deposit",
      "partial",
      "full",
      "balance",
      "additional",
] as const;

const PAYMENT_METHOD = [
      "cash",
      "credit card",
      "debit card",
      "gcash",
      "maya",
      "bank transfer",
      "online banking",
] as const;

const PAYMENT_STATUS = [
      "pending",
      "processing",
      "completed",
      "failed",
      "cancelled",
      "refunded",
      "partially refunded",
] as const;

export const PaymentSchema = z.object({
      // PKs & FKs
      paymentId: z.string().uuid(),
      reservationId: z.string().uuid({
            message: "Invalid reservation ID format, must be UUID to reference",
      }),
      employeeId: z.string().uuid({
            message: "Invalid employee ID format, must be UUID to reference",
      }),

      // Payment Details
      paymentAmount: z
            .number()
            .nonnegative({ message: "payment amount must be positive" })
            .finite()
            .refine((val) => Number(val.toFixed(2)) === val, {
                  message: "Payment amount cannot have more than 2 decimal places",
            }),
      transactionType: z.enum(TRANSACTION_TYPE, {
            message: "Invalid transaction type entry, did not follow system integrated status enums",
      }),
      paymentType: z.enum(PAYMENT_TYPE, {
            message: "Invalid payment type entry, did not follow system integrated status enums",
      }),
      paymentMethod: z.enum(PAYMENT_METHOD, {
            message: "Invalid payment method entry, did not follow system integrated status enums",
      }),
      paymentStatus: z.enum(PAYMENT_STATUS, {
            message: "Invalid payment status entry, did not follow system integrated status enums",
      }),

      // Payment date
      paymentDate: z.coerce.date(),
});

// Schema and DTO for creating
export const CreatePaymentSchema = PaymentSchema.omit({ paymentId: true });
export type CreatePaymentDTO = z.infer<typeof CreatePaymentSchema>;

// Schema and DTO for updating
export const UpdatePaymentSchema = PaymentSchema.pick({
      paymentId: true,
}).merge(PaymentSchema.omit({ paymentId: true }).partial());
export type UpdatePaymentDTO = z.infer<typeof UpdatePaymentSchema>;

// Response DTO
export type PaymentResponseDTO = z.infer<typeof PaymentSchema>;
