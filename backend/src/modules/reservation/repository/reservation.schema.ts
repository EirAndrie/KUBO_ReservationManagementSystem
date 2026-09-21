import { z } from "zod";

const RESERVATION_STATUS = [
      "pending",
      "confirmed",
      "checked in",
      "checked out",
      "cancelled",
      "no show",
] as const;

const BOOKING_SOURCE_ENUM = [
      "walk in",
      "online",
      "phone",
      "email",
      "facebook",
      "travel agency",
      "referral",
      "other",
] as const;

export const ReservationScehma = z.object({
      reservationId: z.string().uuid(),
      referenceCode: z.string({ message: "Reference code is required" }),
      reservationGuestId: z.string().uuid({
            message: "Invalid reservation guest ID format, must be UUID to reference",
      }),
      reservationEmployeeId: z.string().uuid({
            message: "Invalid reservation employee ID format, msut be UUID to reference",
      }),
      reservationTotalAmount: z
            .number()
            .positive({ message: "Total amount must be positive" })
            .finite(),
      reservationStatus: z.enum(RESERVATION_STATUS, {
            message: "Invalid reservation status entry, did not follow system integrated status enums",
      }),
      reservationBookingSource: z.enum(BOOKING_SOURCE_ENUM, {
            message: "Invalid reservation booking source entry, did not follow system integrated booking source enum",
      }),
      reservedAt: z.date().default(() => new Date()),
      reservationCancelledAt: z.date().nullable().default(null),
      cancellationReason: z.string().nullable().default(null),
});

// Schema and DTO for creating
export const CreateReservationSchema = ReservationScehma.omit({
      reservationId: true,
});
export type CreateReservationDTO = z.infer<typeof CreateReservationSchema>;

// Schema and DTO for updating
export const UpdateReservationSchema = ReservationScehma.pick({
      reservationId: true,
}).merge(ReservationScehma.omit({ reservationId: true }).partial());
export type UpdateReservationDTO = z.infer<typeof UpdateReservationSchema>;

// Response DTO
export type ReservationResponseDTO = z.infer<typeof ReservationScehma>;
