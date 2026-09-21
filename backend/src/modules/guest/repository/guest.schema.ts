import { z } from "zod";

const ID_TYPE_ENUMS = [
      "passport",
      "drivers license",
      "national id",
      "phil health id",
      "sss id",
      "um id",
      "postal id",
      "prc id",
      "voters id",
      "senior citizen id",
      "student id",
      "other",
] as const;

export const GuestSchema = z.object({
      guestId: z.string().uuid(),
      firstName: z
            .string()
            .nonempty({ message: "Guest first name is required" }),
      lastName: z.string().nonempty({ message: "Guest last name is required" }),
      email: z
            .string()
            .email({ message: "Guest email must be a valid email format" })
            .optional(),
      phone: z.e164({
            message: "Gues phone number must be in a valid format +09XXXXXXXX",
      }),
      addressLine1: z.string({ message: "Guest address line is required" }),
      city: z.string({ message: "Guest city is required" }),
      stateProvince: z.string({ message: "Guest state province is required" }),
      zidPostalCode: z.string({ message: "Guest postal code is required" }),
      country: z.string({ message: "Guest country is required" }),
      validIdType: z.enum(ID_TYPE_ENUMS, { message: "Guest ID invalid" }),
      idNumber: z.string({
            message: "Guest ID number is required and must be valid",
      }),
});

// Schema and DTO for creating
export const CreateGuestSchema = GuestSchema.omit({ guestId: true });
export type CreateGuestDTO = z.infer<typeof CreateGuestSchema>;

// Schema and DTO for updating
export const UpdateGuestSchema = GuestSchema.pick({ guestId: true }).merge(
      GuestSchema.omit({ guestId: true }).partial(),
);
export type UpdateGuestDTO = z.infer<typeof UpdateGuestSchema>;

// Response DTO
export type GuestResponseDTO = z.infer<typeof GuestSchema>;
