import { z } from "zod";

const ADDITIONAL_CHARGE_TYPE = [
      "extra bed",
      "extra person",
      "late check out",
      "early check in",
      "room service",
      "food and beverage",
      "laundry",
      "cleaning fee",
      "damage",
      "lost key",
      "lost item",
      "mini bar",
      "other",
] as const;

export const AdditionalChargeSchema = z.object({
      // PKs & FKs
      additionalChargeId: z.string().uuid(),
      resrvationId: z.string().uuid({
            message: "Invalid reservation ID format, must be UUID to reference",
      }),
      employeeId: z.string().uuid({
            message: "Invalid employee ID format, must be UUID to reference",
      }),

      // Additional charge details
      additionalChargeType: z.enum(ADDITIONAL_CHARGE_TYPE, {
            message: "Invalid additional charge type entry, did not follow system integrated status enums",
      }),
      additionalChargeAmount: z
            .number()
            .nonnegative({
                  message: "Additional charge amount must be positive",
            })
            .finite()
            .refine((val) => Number(val.toFixed(2)) === val, {
                  message: "Additional charge amount cannot have more than 2 decimal places",
            }),
      additionalChargeDescription: z.string({
            message: "Additional charge description is required for information/context of the charge",
      }),
      chargeDate: z.coerce.date(),
});

// Schema and DTO for creating
export const CreateAdditionalChargeSchema = AdditionalChargeSchema.omit({
      additionalChargeId: true,
});
export type CreateAdditionalChargeDTO = z.infer<
      typeof CreateAdditionalChargeSchema
>;

// Schema and DTO for updating
export const UpdateAdditionalChargeSchema = AdditionalChargeSchema.pick({
      additionalChargeId: true,
}).merge(AdditionalChargeSchema.omit({ additionalChargeId: true }).partial());
export type UpdateAdditionalChargeDTO = z.infer<
      typeof UpdateAdditionalChargeSchema
>;

// Response DTO
export type AdditionalChargeResponseDTO = z.infer<
      typeof AdditionalChargeSchema
>;
