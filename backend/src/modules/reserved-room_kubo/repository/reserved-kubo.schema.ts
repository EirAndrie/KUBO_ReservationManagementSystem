import { z } from "zod";

const RESERVED_KUBO_STATUS = [
      "reserved",
      "checkd in",
      "checked out",
      "cancelled",
      "no show",
] as const;

export const ReservedKuboSchema = z
      .object({
            /** PK / FK – identifies the reservation */
            reservationId: z.string().uuid({
                  message: "Invalid reservation ID format, must be UUID to reference",
            }),
            /** PK / FK – identifies the Kubo (room) */
            kuboId: z.string().uuid({
                  message: "Invalid room to be reserved ID format, must be UUID to reference",
            }),

            /** Calendar dates */
            checkInDate: z.coerce.date(),
            checkOutDate: z.coerce.date(),

            /** Scheduled timeline */
            scheduledCheckInTime: z.coerce.date(),
            scheduledCheckOutTime: z.coerce.date(),

            /** Actual timeline – filled later */
            actualCheckInDateTime: z.coerce.date().nullable().default(null),
            actualCheckOutDateTime: z.coerce.date().nullable().default(null),
            earlyCheckInApproved: z.boolean().default(false),

            /** Pricing */
            priceAtBooking: z
                  .number()
                  .nonnegative({ message: "Price cannot be negative" })
                  .finite()
                  .refine((val) => Number(val.toFixed(2)) === val, {
                        message: "Price cannot have more than 2 decimal places",
                  }),

            /** Current status of this assignment */
            reservedKuboStatus: z.enum(RESERVED_KUBO_STATUS, {
                  message: "Invalid reserved kubo status entry",
            }),
      })
      .refine((data) => data.checkOutDate > data.checkInDate, {
            message: "Check-out date must be after the check-in date",
            path: ["checkOutDate"],
      })
      .refine(
            (data) => data.scheduledCheckOutTime > data.scheduledCheckInTime,
            {
                  message: "Scheduled check-out time must be after scheduled check-in time",
                  path: ["scheduledCheckOutTime"],
            },
      );

// Schema and DTO for creating
export const CreateReservedKuboSchema = ReservedKuboSchema.omit({});
export type CreateReservedKuboDTO = z.infer<typeof CreateReservedKuboSchema>;

// Schema and DTO for updating
export const UpdateReservedKuboSchema = ReservedKuboSchema.pick({
      reservationId: true,
      kuboId: true,
}).merge(
      ReservedKuboSchema.omit({ reservationId: true, kuboId: true }).partial(),
);
export type UpdateReservedKuboDTO = z.infer<typeof UpdateReservedKuboSchema>;

// Response DTO
export type ReservedKuboResponseDTO = z.infer<typeof ReservedKuboSchema>;
