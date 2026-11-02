import { z } from "zod";

const TRANSACTION_TYPE = [
      "Payment",
      "Refund",
      "Adjustment",
      "Reversal",
] as const;

const PAYMENT_TYPE = [
      "Deposit",
      "PartialPayment",
      "FullPayment",
      "BalancePayment",
      "AdditionalCharge",
] as const;

const PAYMENT_METHOD = [
      "Cash",
      "CreditCard",
      "DebitCard",
      "GCash",
      "Maya",
      "BankTransfer",
      "OnlineBanking",
      "Other",
] as const;

const PAYMENT_STATUS = [
      "Pending",
      "Processing",
      "Completed",
      "Failed",
      "Cancelled",
      "Refunded",
      "PartiallyRefunded",
] as const;

export const TransactionTypeSchema = z.enum(TRANSACTION_TYPE, {
      message: "Invalid transaction type",
});

export const PaymentTypeSchema = z.enum(PAYMENT_TYPE, {
      message: "Invalid payment type",
});

export const PaymentMethodSchema = z.enum(PAYMENT_METHOD, {
      message: "Invalid payment method",
});

export const PaymentStatusSchema = z.enum(PAYMENT_STATUS, {
      message: "Invalid payment status",
});

const optionalUuid = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.string().uuid().optional(),
);

const optionalDate = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.coerce.date().optional(),
);

const normalizePayment = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            employeeId: input.employeeId ?? input.employee_id,
            paymentAmount: input.paymentAmount ?? input.payment_amount,
            paymentType: input.paymentType ?? input.payment_type,
            paymentMethod: input.paymentMethod ?? input.payment_method,
            status: input.status ?? input.paymentStatus ?? input.payment_status,
            originalPaymentId:
                  input.originalPaymentId ?? input.original_payment_id,
      };
};

export const CreatePaymentSchema = z.preprocess(
      normalizePayment,
      z.object({
            employeeId: z.string().uuid({
                  message: "Employee ID is required",
            }),
            paymentAmount: z
                  .number()
                  .nonnegative({
                        message: "Payment amount must be non-negative",
                  })
                  .refine((value) => Number(value.toFixed(2)) === value, {
                        message:
                              "Payment amount cannot have more than 2 decimals",
                  }),
            paymentType: PaymentTypeSchema,
            paymentMethod: PaymentMethodSchema,
      }),
);

export type CreatePaymentDTO = z.infer<typeof CreatePaymentSchema>;

export const RefundPaymentSchema = z.preprocess(
      normalizePayment,
      z.object({
            employeeId: z.string().uuid({
                  message: "Employee ID is required",
            }),
            originalPaymentId: z.string().uuid({
                  message: "Original payment ID is required",
            }),
            paymentAmount: z
                  .number()
                  .positive({
                        message: "Refund amount must be positive",
                  })
                  .refine((value) => Number(value.toFixed(2)) === value, {
                        message:
                              "Refund amount cannot have more than 2 decimals",
                  }),
            paymentType: PaymentTypeSchema,
            paymentMethod: PaymentMethodSchema,
      }),
);

export type RefundPaymentDTO = z.infer<typeof RefundPaymentSchema>;

export const UpdatePaymentStatusSchema = z.preprocess(
      normalizePayment,
      z.object({
            employeeId: z.string().uuid({
                  message: "Employee ID is required",
            }),
            status: PaymentStatusSchema,
      }),
);

export type UpdatePaymentStatusDTO = z.infer<
      typeof UpdatePaymentStatusSchema
>;

export const PaymentFilterSchema = z.object({
      reservationId: optionalUuid,
      employeeId: optionalUuid,
      paymentStatus: PaymentStatusSchema.optional(),
      paymentMethod: PaymentMethodSchema.optional(),
      transactionType: TransactionTypeSchema.optional(),
      createdFrom: optionalDate,
      createdTo: optionalDate,
});

export type PaymentFilterDTO = z.infer<typeof PaymentFilterSchema>;

export const DeletePaymentActorSchema = z.object({
      employeeId: z.string().uuid({
            message: "Administrator employee ID is required",
      }),
});

export type DeletePaymentActorDTO = z.infer<
      typeof DeletePaymentActorSchema
>;

export type PaymentResponseDTO = {
      payment_id: string;
      reservation_id: string;
      reference_code: string;
      employee_id: string;
      recorded_by: string;
      payment_amount: string;
      transaction_type: (typeof TRANSACTION_TYPE)[number];
      payment_type: (typeof PAYMENT_TYPE)[number];
      payment_method: (typeof PAYMENT_METHOD)[number];
      payment_status: (typeof PAYMENT_STATUS)[number];
      payment_date: string;
};
