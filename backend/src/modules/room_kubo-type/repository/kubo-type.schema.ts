import { z } from "zod";

export const KuboTypeSchema = z.object({
      kuboTypeId: z.string().uuid(),
      kuboTypeName: z
            .string()
            .trim()
            .min(1, { message: "Kubo type name is required" })
            .max(100, {
                  message: "Kubo type name cannot exceed 100 characters",
            }),
      kuboTypeCapacity: z
            .number({
                  message: "Kubo type capacity is required and must be a number",
            })
            .int({ message: "Capacity must be a whole number" })
            .positive({ message: "Capacity must be greater than zero" }),
      pricePerNight: z
            .number({
                  message: "Price per night is required and must be a number",
            })
            .nonnegative({ message: "Price per night cannot be negative" })
            .finite()
            .refine((val) => Number(val.toFixed(2)) === val, {
                  message: "Price cannot have more than 2 decimal places",
            }),
      kuboTypeDescription: z
            .string()
            .trim()
            .max(255, {
                  message: "Kubo type description cannot exceed 255 characters",
            })
            .optional(),
});

const optionalFilterText = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.string().trim().min(1).max(100).optional(),
);

const optionalFilterNumber = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.coerce.number().int().nonnegative().optional(),
);

export const KuboTypeFilterSchema = z
      .object({
            search: optionalFilterText,
            minCapacity: optionalFilterNumber,
            maxCapacity: optionalFilterNumber,
      })
      .refine(
            (value) =>
                  value.minCapacity === undefined ||
                  value.maxCapacity === undefined ||
                  value.minCapacity <= value.maxCapacity,
            {
                  message: "Minimum capacity cannot exceed maximum capacity",
                  path: ["minCapacity"],
            },
      );

export type KuboTypeFilterDTO = z.infer<typeof KuboTypeFilterSchema>;

/**
 * Accept both the module's camelCase contract and the snake_case column names
 * returned by the API. This prevents a client from filling an edit form with a
 * GET response and having every update field silently stripped by Zod.
 */
const normalizeKuboTypeInput = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            kuboTypeName:
                  input.kuboTypeName ??
                  input.type_name ??
                  input.kubo_type_name,
            kuboTypeCapacity:
                  input.kuboTypeCapacity ??
                  input.kubo_type_capacity ??
                  input.capacity,
            pricePerNight:
                  input.pricePerNight ??
                  input.price_per_night,
            kuboTypeDescription:
                  input.kuboTypeDescription ??
                  input.kubo_type_description ??
                  input.description,
      };
};

const KuboTypeInputSchema = KuboTypeSchema.omit({ kuboTypeId: true });

// Schema and DTO for creating
export const CreateKuboTypeSchema = z.preprocess(
      normalizeKuboTypeInput,
      KuboTypeInputSchema,
);
export type CreateKuboTypeDTO = z.infer<typeof CreateKuboTypeSchema>;

// Schema and DTO for updating
export const UpdateKuboTypeSchema = z.preprocess(
      normalizeKuboTypeInput,
      KuboTypeInputSchema.partial(),
);
export type UpdateKuboTypeDTO = z.infer<typeof UpdateKuboTypeSchema>;

// Response DTO
export type KuboTypeResponseDTO = z.infer<typeof KuboTypeSchema>;
