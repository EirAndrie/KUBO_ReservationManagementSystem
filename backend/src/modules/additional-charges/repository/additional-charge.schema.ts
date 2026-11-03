import { z } from "zod";

const CHARGE_TYPES = [
      "ExtraBed",
      "ExtraPerson",
      "LateCheckOut",
      "EarlyCheckIn",
      "RoomService",
      "FoodAndBeverage",
      "Laundry",
      "CleaningFee",
      "Damage",
      "LostKey",
      "LostItem",
      "Transportation",
      "Minibar",
      "Other",
] as const;

const CHARGE_REQUEST_STATUS = [
      "Pending",
      "Approved",
      "Rejected",
      "Withdrawn",
] as const;

export const ChargeTypeSchema = z.enum(CHARGE_TYPES, {
      message: "Invalid additional-charge type",
});

export const ChargeRequestStatusSchema = z.enum(CHARGE_REQUEST_STATUS, {
      message: "Invalid charge-request status",
});

const optionalText = (max: number) =>
      z.preprocess(
            (value) =>
                  typeof value === "string" && value.trim() === ""
                        ? undefined
                        : value,
            z.string().trim().max(max).optional(),
      );

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

const normalizeCatalog = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            chargeType: input.chargeType ?? input.charge_type,
            name: input.name,
            description: input.description,
            unitPrice: input.unitPrice ?? input.unit_price,
            isActive: input.isActive ?? input.is_active,
      };
};

const normalizeApplyCharge = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            catalogId: input.catalogId ?? input.catalog_id,
            quantity: input.quantity,
      };
};

const normalizeCustomRequest = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            description: input.description,
            quantity: input.quantity,
            proposedUnitAmount:
                  input.proposedUnitAmount ?? input.proposed_unit_amount,
      };
};

const normalizeCorrection = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            chargeType: input.chargeType ?? input.charge_type,
            quantity: input.quantity,
            unitAmount: input.unitAmount ?? input.unit_amount,
            reason: input.reason,
      };
};

/**
 * Internal wrapper adding the acting employee (sourced from the access token,
 * never from the client) to a validated mutation payload.
 */
export type WithActor<T> = T & { employeeId: string };

export const CreateCatalogItemSchema = z.preprocess(
      normalizeCatalog,
      z.object({
            chargeType: ChargeTypeSchema,
            name: z.string().trim().min(1).max(100),
            description: optionalText(255),
            unitPrice: z
                  .number()
                  .nonnegative()
                  .refine((value) => Number(value.toFixed(2)) === value, {
                        message: "Unit price cannot have more than 2 decimals",
                  }),
            isActive: z.boolean().optional().default(true),
      }),
);

export type CreateCatalogItemDTO = z.infer<typeof CreateCatalogItemSchema>;

export const UpdateCatalogItemSchema = z.preprocess(
      normalizeCatalog,
      z
            .object({
                  chargeType: ChargeTypeSchema.optional(),
                  name: z.string().trim().min(1).max(100).optional(),
                  description: optionalText(255).nullable(),
                  unitPrice: z
                        .number()
                        .nonnegative()
                        .refine(
                              (value) =>
                                    Number(value.toFixed(2)) === value,
                              {
                                    message:
                                          "Unit price cannot have more than 2 decimals",
                              },
                        )
                        .optional(),
                  isActive: z.boolean().optional(),
            })
            .refine(
                  (value) =>
                        value.chargeType !== undefined ||
                        value.name !== undefined ||
                        value.description !== undefined ||
                        value.unitPrice !== undefined ||
                        value.isActive !== undefined,
                  { message: "Provide at least one catalog field to update" },
            ),
);

export type UpdateCatalogItemDTO = z.infer<typeof UpdateCatalogItemSchema>;

export const CatalogFilterSchema = z.object({
      search: optionalText(100),
      activeOnly: z
            .preprocess(
                  (value) =>
                        typeof value === "string"
                              ? value === "true"
                              : value,
                  z.boolean().optional().default(true),
            ),
});

export type CatalogFilterDTO = z.infer<typeof CatalogFilterSchema>;

export const ApplyCatalogChargeSchema = z.preprocess(
      normalizeApplyCharge,
      z.object({
            catalogId: z.string().uuid({
                  message: "Catalog ID is required",
            }),
            quantity: z.number().int().positive().default(1),
      }),
);

export type ApplyCatalogChargeDTO = z.infer<
      typeof ApplyCatalogChargeSchema
>;

export const CustomChargeRequestSchema = z.preprocess(
      normalizeCustomRequest,
      z.object({
            description: z.string().trim().min(1).max(255),
            quantity: z.number().int().positive().default(1),
            proposedUnitAmount: z
                  .number()
                  .nonnegative()
                  .refine((value) => Number(value.toFixed(2)) === value, {
                        message:
                              "Proposed unit amount cannot have more than 2 decimals",
                  }),
      }),
);

export type CustomChargeRequestDTO = z.infer<
      typeof CustomChargeRequestSchema
>;

export const ApproveChargeRequestSchema = z.object({
      approvedUnitAmount: z
            .number()
            .nonnegative()
            .refine((value) => Number(value.toFixed(2)) === value, {
                  message:
                        "Approved unit amount cannot have more than 2 decimals",
            })
            .optional(),
      reason: optionalText(255),
});

export type ApproveChargeRequestDTO = z.infer<
      typeof ApproveChargeRequestSchema
>;

export const RejectChargeRequestSchema = z.object({
      reason: z.string().trim().min(1).max(255),
});

export type RejectChargeRequestDTO = z.infer<
      typeof RejectChargeRequestSchema
>;

export const ChargeRequestFilterSchema = z.object({
      status: ChargeRequestStatusSchema.optional(),
      reservationId: optionalUuid,
      requestedBy: optionalUuid,
});

export type ChargeRequestFilterDTO = z.infer<
      typeof ChargeRequestFilterSchema
>;

export const ChargeFilterSchema = z.object({
      reservationId: optionalUuid,
      employeeId: optionalUuid,
      chargeType: ChargeTypeSchema.optional(),
      createdFrom: optionalDate,
      createdTo: optionalDate,
});

export type ChargeFilterDTO = z.infer<typeof ChargeFilterSchema>;

export const AddChargeCorrectionSchema = z.preprocess(
      normalizeCorrection,
      z.object({
            chargeType: ChargeTypeSchema,
            quantity: z.number().int().positive().default(1),
            unitAmount: z
                  .number()
                  .nonnegative()
                  .refine((value) => Number(value.toFixed(2)) === value, {
                        message:
                              "Unit amount cannot have more than 2 decimals",
                  }),
            reason: z.string().trim().min(1).max(255),
      }),
);

export type AddChargeCorrectionDTO = z.infer<
      typeof AddChargeCorrectionSchema
>;

export type AdditionalChargeCatalogResponseDTO = {
      catalog_id: string;
      charge_type: (typeof CHARGE_TYPES)[number];
      name: string;
      description: string | null;
      unit_price: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      usage_count: number;
      applied_total: string;
};

export type AdditionalChargeResponseDTO = {
      charge_id: string;
      reservation_id: string;
      reference_code: string;
      employee_id: string;
      recorded_by: string;
      catalog_id: string | null;
      catalog_name: string | null;
      request_id: string | null;
      charge_type: (typeof CHARGE_TYPES)[number];
      quantity: number;
      unit_amount: string;
      amount: string;
      description: string | null;
      charge_date: string;
};

export type AdditionalChargeRequestResponseDTO = {
      request_id: string;
      reservation_id: string;
      reference_code: string;
      guest_name: string;
      requested_by: string;
      requested_by_name: string;
      charge_type: (typeof CHARGE_TYPES)[number];
      description: string;
      quantity: number;
      proposed_unit_amount: string;
      status: (typeof CHARGE_REQUEST_STATUS)[number];
      reviewed_by: string | null;
      reviewed_by_name: string | null;
      approved_unit_amount: string | null;
      review_reason: string | null;
      created_at: string;
      reviewed_at: string | null;
};
