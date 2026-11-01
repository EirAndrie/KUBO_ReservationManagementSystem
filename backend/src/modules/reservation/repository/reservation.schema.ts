import { z } from "zod";

const RESERVATION_STATUS = [
      "Pending",
      "Confirmed",
      "CheckedIn",
      "CheckedOut",
      "Cancelled",
      "NoShow",
] as const;

const BOOKING_SOURCE = [
      "WalkIn",
      "Online",
      "Phone",
      "Email",
      "Facebook",
      "TravelAgency",
      "Referral",
      "Other",
] as const;

export const ReservationStatusSchema = z.enum(RESERVATION_STATUS, {
      message: "Invalid reservation status",
});

export const BookingSourceSchema = z.enum(BOOKING_SOURCE, {
      message: "Invalid booking source",
});

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const optionalTime = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z
            .string()
            .regex(TIME_PATTERN, {
                  message: "Time must use HH:MM or HH:MM:SS format",
            })
            .optional(),
);

const optionalDate = z.preprocess(
      (value) =>
            typeof value === "string" && value.trim() === ""
                  ? undefined
                  : value,
      z.coerce.date().optional(),
);

const normalizeAssignment = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            kuboId: input.kuboId ?? input.kubo_id,
            checkInDate: input.checkInDate ?? input.check_in_date,
            checkOutDate: input.checkOutDate ?? input.check_out_date,
            scheduledCheckInTime:
                  input.scheduledCheckInTime ??
                  input.scheduled_check_in_time,
            scheduledCheckOutTime:
                  input.scheduledCheckOutTime ??
                  input.scheduled_check_out_time,
      };
};

const normalizeReservationInput = (value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return value;
      }

      const input = value as Record<string, unknown>;

      return {
            guestId: input.guestId ?? input.guest_id,
            employeeId: input.employeeId ?? input.employee_id,
            bookingSource: input.bookingSource ?? input.booking_source,
            assignments: input.assignments,
      };
};

export const ReservationAssignmentSchema = z.preprocess(
      normalizeAssignment,
      z
            .object({
                  kuboId: z.string().uuid({
                        message: "Invalid kubo ID format",
                  }),
                  checkInDate: z.coerce.date({
                        message: "Check-in date is required",
                  }),
                  checkOutDate: z.coerce.date({
                        message: "Check-out date is required",
                  }),
                  scheduledCheckInTime: optionalTime,
                  scheduledCheckOutTime: optionalTime,
            })
            .refine((value) => value.checkOutDate > value.checkInDate, {
                  message: "Check-out must be later than check-in",
                  path: ["checkOutDate"],
            })
            .refine(
                  (value) =>
                        value.scheduledCheckInTime === undefined ||
                        value.scheduledCheckOutTime === undefined ||
                        value.scheduledCheckOutTime >
                              value.scheduledCheckInTime,
                  {
                        message:
                              "Scheduled check-out time must be later than scheduled check-in time",
                        path: ["scheduledCheckOutTime"],
                  },
            ),
);

export type ReservationAssignmentDTO = z.infer<
      typeof ReservationAssignmentSchema
>;

export const CreateReservationSchema = z.preprocess(
      normalizeReservationInput,
      z.object({
            guestId: z.string().uuid({
                  message: "Guest ID is required",
            }),
            // Temporary until authentication provides the acting employee.
            employeeId: z.string().uuid({
                  message: "Employee ID is required",
            }),
            bookingSource: BookingSourceSchema,
            assignments: z
                  .array(ReservationAssignmentSchema)
                  .min(1, {
                        message: "At least one kubo assignment is required",
                  }),
      }),
);

export type CreateReservationDTO = z.infer<typeof CreateReservationSchema>;

export const UpdateReservationSchema = z.preprocess(
      normalizeReservationInput,
      z
            .object({
                  guestId: z.string().uuid().optional(),
                  bookingSource: BookingSourceSchema.optional(),
            })
            .refine(
                  (value) =>
                        value.guestId !== undefined ||
                        value.bookingSource !== undefined,
                  {
                        message: "Provide at least one field to update",
                  },
            ),
);

export type UpdateReservationDTO = z.infer<typeof UpdateReservationSchema>;

export const CancelReservationSchema = z.object({
      reason: z
            .string()
            .trim()
            .min(1, { message: "Cancellation reason is required" })
            .max(255, {
                  message: "Cancellation reason cannot exceed 255 characters",
            }),
});

export type CancelReservationDTO = z.infer<typeof CancelReservationSchema>;

export const ReservationFilterSchema = z
      .object({
            status: ReservationStatusSchema.optional(),
            bookingSource: BookingSourceSchema.optional(),
            search: z
                  .preprocess(
                        (value) =>
                              typeof value === "string" && value.trim() === ""
                                    ? undefined
                                    : value,
                        z.string().trim().min(1).max(100).optional(),
                  ),
            guestId: z
                  .preprocess(
                        (value) =>
                              typeof value === "string" && value.trim() === ""
                                    ? undefined
                                    : value,
                        z.string().uuid().optional(),
                  ),
            employeeId: z
                  .preprocess(
                        (value) =>
                              typeof value === "string" && value.trim() === ""
                                    ? undefined
                                    : value,
                        z.string().uuid().optional(),
                  ),
            checkInDate: optionalDate,
            checkOutDate: optionalDate,
      })
      .refine(
            (value) =>
                  value.checkInDate === undefined ||
                  value.checkOutDate === undefined ||
                  value.checkOutDate > value.checkInDate,
            {
                  message: "Check-out filter must be later than check-in filter",
                  path: ["checkOutDate"],
            },
      );

export type ReservationFilterDTO = z.infer<typeof ReservationFilterSchema>;

export type ReservationResponseDTO = {
      reservation_id: string;
      reference_code: string;
      guest_id: string;
      guest_name: string;
      employee_id: string;
      employee_name: string;
      status: (typeof RESERVATION_STATUS)[number];
      booking_source: (typeof BOOKING_SOURCE)[number];
      cancelled_at: string | null;
      cancellation_reason: string | null;
      reserved_at: string;
      accommodation_total: string;
      charges_total: string;
      net_paid: string;
      outstanding_balance: string;
      assignments: Array<Record<string, unknown>>;
};
