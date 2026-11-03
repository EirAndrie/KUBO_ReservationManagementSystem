import { z } from "zod";

const RESERVED_KUBO_STATUS = [
      "Reserved",
      "CheckedIn",
      "CheckedOut",
      "Cancelled",
      "NoShow",
] as const;

export const ReservedKuboStatusSchema = z.enum(RESERVED_KUBO_STATUS, {
      message: "Invalid reserved kubo status",
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

const normalizeReservedKuboInput = (value: unknown) => {
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

export const CreateReservedKuboSchema = z.preprocess(
      normalizeReservedKuboInput,
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

export type CreateReservedKuboDTO = z.infer<
      typeof CreateReservedKuboSchema
>;

export const UpdateReservedKuboSchema = z.preprocess(
      normalizeReservedKuboInput,
      z
            .object({
                  checkInDate: z.coerce.date().optional(),
                  checkOutDate: z.coerce.date().optional(),
                  scheduledCheckInTime: optionalTime,
                  scheduledCheckOutTime: optionalTime,
            })
            .refine(
                  (value) =>
                        value.checkInDate !== undefined ||
                        value.checkOutDate !== undefined ||
                        value.scheduledCheckInTime !== undefined ||
                        value.scheduledCheckOutTime !== undefined,
                  {
                        message: "Provide at least one assignment field to update",
                  },
            )
            .refine(
                  (value) =>
                        value.checkInDate === undefined ||
                        value.checkOutDate === undefined ||
                        value.checkOutDate > value.checkInDate,
                  {
                        message: "Check-out must be later than check-in",
                        path: ["checkOutDate"],
                  },
            ),
);

export type UpdateReservedKuboDTO = z.infer<
      typeof UpdateReservedKuboSchema
>;

/**
 * Internal wrapper adding the acting employee (sourced from the access token,
 * never from the client) to a validated mutation payload.
 */
export type WithActor<T> = T & { employeeId: string };

export type ReservedKuboResponseDTO = {
      reservation_id: string;
      kubo_id: string;
      kubo_number: string;
      kubo_type_id: string;
      type_name: string;
      check_in_date: string;
      check_out_date: string;
      scheduled_check_in_time: string | null;
      scheduled_check_out_time: string | null;
      actual_check_in_datetime: string | null;
      actual_check_out_datetime: string | null;
      early_check_in_approved: boolean;
      price_at_booking: string;
      status: (typeof RESERVED_KUBO_STATUS)[number];
      nights: number;
      amount: string;
};
