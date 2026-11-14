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
            paymentAmount: input.paymentAmount ?? input.payment_amount,
            paymentType: input.paymentType ?? input.payment_type,
            paymentMethod: input.paymentMethod ?? input.payment_method,
            status: input.status ?? input.paymentStatus ?? input.payment_status,
            originalPaymentId:
                  input.originalPaymentId ?? input.original_payment_id,
            overpaymentApprovalId:
                  input.overpaymentApprovalId ??
                  input.overpayment_approval_id,
      };
};

/** Normalize the public correction fields without accepting a caller-supplied actor. */
const normalizeChargeCorrection = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            paymentAmount: input.paymentAmount ?? input.payment_amount,
            chargeId:
                  input.chargeId ?? input.charge_id ?? input.related_charge_id,
            description: input.description ?? input.reason,
      };
};

/**
 * Internal wrapper adding the acting employee (sourced from the access token,
 * never from the client) to a validated mutation payload.
 */
export type WithActor<T> = T & { employeeId: string };

export const CreatePaymentSchema = z.preprocess(
      normalizePayment,
      z.object({
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
            /**
             * BR-053: required only when the amount exceeds the outstanding
             * balance; names an Administrator approval covering the excess.
             */
            overpaymentApprovalId: z
                  .string()
                  .uuid({ message: "Invalid overpayment approval ID" })
                  .optional(),
      }),
);

export type CreatePaymentDTO = z.infer<typeof CreatePaymentSchema>;

export const RefundPaymentSchema = z.preprocess(
      normalizePayment,
      z.object({
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

const positiveCurrencyAmount = z
      .number()
      .positive({ message: "Amount must be positive" })
      .refine((value) => Number(value.toFixed(2)) === value, {
            message: "Amount cannot have more than 2 decimals",
      });

/** One audited credit reducing a specific applied additional charge. */
export const CreateChargeAdjustmentSchema = z.preprocess(
      normalizeChargeCorrection,
      z.object({
            chargeId: z.string().uuid({ message: "Charge ID is required" }),
            paymentAmount: positiveCurrencyAmount,
            description: z
                  .string()
                  .trim()
                  .min(1, { message: "A reason is required" })
                  .max(255),
      }),
);

export type CreateChargeAdjustmentDTO = z.infer<
      typeof CreateChargeAdjustmentSchema
>;

/** Reverses some or all of a prior Administrator charge Adjustment. */
export const ReverseChargeAdjustmentSchema = z.preprocess(
      normalizeChargeCorrection,
      z.object({
            paymentAmount: positiveCurrencyAmount,
            description: z
                  .string()
                  .trim()
                  .min(1, { message: "A reason is required" })
                  .max(255),
      }),
);

export type ReverseChargeAdjustmentDTO = z.infer<
      typeof ReverseChargeAdjustmentSchema
>;

/**
 * BR-053: an Administrator authorizes one payment on a reservation to exceed
 * the outstanding balance by at most `maxOverpaymentAmount`.
 */
export const CreateOverpaymentApprovalSchema = z.preprocess(
      (value) => {
            if (value === null || typeof value !== "object" || Array.isArray(value)) {
                  return value;
            }
            const input = value as Record<string, unknown>;
            return {
                  maxOverpaymentAmount:
                        input.maxOverpaymentAmount ??
                        input.max_overpayment_amount,
                  reason: input.reason ?? input.description,
            };
      },
      z.object({
            maxOverpaymentAmount: positiveCurrencyAmount,
            reason: z
                  .string()
                  .trim()
                  .min(1, { message: "A reason is required" })
                  .max(255),
      }),
);

export type CreateOverpaymentApprovalDTO = z.infer<
      typeof CreateOverpaymentApprovalSchema
>;

export type OverpaymentApprovalResponseDTO = {
      approval_id: string;
      reservation_id: string;
      approved_by: string;
      approved_by_name: string;
      max_overpayment_amount: string;
      reason: string;
      status: "Available" | "Used" | "Revoked";
      payment_id: string | null;
      revoked_by: string | null;
      revoked_by_name: string | null;
      revoked_at: string | null;
      created_at: string;
};

export const UpdatePaymentStatusSchema = z.preprocess(
      normalizePayment,
      z.object({
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
      description: string | null;
      related_payment_id: string | null;
      related_charge_id: string | null;
};
