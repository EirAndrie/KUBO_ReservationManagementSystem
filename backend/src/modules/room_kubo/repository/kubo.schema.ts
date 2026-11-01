import { z } from "zod";

const KUBO_STATUS = [
      "Available",
      "Reserved",
      "Occupied",
      "Maintenance",
      "OutOfService",
      "Cleaning",
      "UnderInspection",
] as const;

export const KuboStatusSchema = z.enum(KUBO_STATUS, {
      message: "Invalid Kubo status entry",
});

const normalizeKuboInput = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            kuboTypeId: input.kuboTypeId ?? input.kubo_type_id,
            kuboNumber:
                  input.kuboNumber ??
                  input.kubo_number ??
                  input.kuboRoomNumber,
            status: input.status ?? input.kuboStatus ?? input.kubo_status,
      };
};

const optionalFilterText = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.string().trim().min(1).max(100).optional(),
);

const optionalFilterUuid = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.string().uuid().optional(),
);

const KuboWriteFieldsSchema = z.object({
      kuboTypeId: z.string().uuid({
            message: "Invalid kubo type ID format, must be a UUID",
      }),
      kuboNumber: z
            .string()
            .trim()
            .min(1, { message: "Kubo number is required" })
            .max(20, { message: "Kubo number cannot exceed 20 characters" }),
});

export const KuboFilterSchema = z.object({
      search: optionalFilterText,
      kuboTypeId: optionalFilterUuid,
      status: KuboStatusSchema.optional(),
});

export type KuboFilterDTO = z.infer<typeof KuboFilterSchema>;

export const KuboAvailabilitySchema = z
      .object({
            checkIn: z.coerce.date({
                  message: "Check-in date is required",
            }),
            checkOut: z.coerce.date({
                  message: "Check-out date is required",
            }),
            kuboTypeId: optionalFilterUuid,
      })
      .refine((value) => value.checkOut > value.checkIn, {
            message: "Check-out must be later than check-in",
            path: ["checkOut"],
      });

export type KuboAvailabilityDTO = z.infer<typeof KuboAvailabilitySchema>;

// Schema and DTO for creating
export const CreateKuboSchema = z.preprocess(
      normalizeKuboInput,
      KuboWriteFieldsSchema.extend({
            status: KuboStatusSchema.default("Available"),
      }),
);
export type CreateKuboDTO = z.infer<typeof CreateKuboSchema>;

// Schema and DTO for updating number/type only; status uses its own endpoint
export const UpdateKuboSchema = z.preprocess(
      normalizeKuboInput,
      KuboWriteFieldsSchema.partial(),
);
export type UpdateKuboDTO = z.infer<typeof UpdateKuboSchema>;

export const ChangeKuboStatusSchema = z.object({
      status: KuboStatusSchema,
});
export type ChangeKuboStatusDTO = z.infer<typeof ChangeKuboStatusSchema>;

// Response DTO
export const KuboResponseSchema = z.object({
      kuboId: z.string().uuid(),
      kuboNumber: z.string(),
      kuboTypeId: z.string().uuid(),
      typeName: z.string(),
      capacity: z.number(),
      pricePerNight: z.number(),
      status: KuboStatusSchema,
});
export type KuboResponseDTO = z.infer<typeof KuboResponseSchema>;
