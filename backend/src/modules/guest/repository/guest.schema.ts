import { z } from "zod";

const ID_TYPE_ENUMS = [
      "Passport",
      "DriverLicense",
      "NationalID",
      "PhilHealthID",
      "SSSID",
      "UMID",
      "PostalID",
      "PRCID",
      "VotersID",
      "SeniorCitizenID",
      "StudentID",
      "Other",
] as const;

const PHONE_PATTERN = /^(09\d{9}|\+639\d{9})$/;

export const GuestSchema = z.object({
      guestId: z.string().uuid(),
      firstName: z
            .string()
            .trim()
            .min(1, { message: "Guest first name is required" })
            .max(100, { message: "Guest first name cannot exceed 100 characters" }),
      lastName: z
            .string()
            .trim()
            .min(1, { message: "Guest last name is required" })
            .max(100, { message: "Guest last name cannot exceed 100 characters" }),
      email: z
            .string()
            .trim()
            .email({ message: "Guest email must be a valid email format" })
            .max(100, { message: "Guest email cannot exceed 100 characters" }),
      phone: z
            .string()
            .trim()
            .regex(PHONE_PATTERN, {
                  message: "Guest phone must use 09XXXXXXXXX or +639XXXXXXXXX format",
            }),
      addressLine1: z
            .string()
            .trim()
            .max(200, { message: "Guest address cannot exceed 200 characters" })
            .optional(),
      city: z
            .string()
            .trim()
            .max(100, { message: "Guest city cannot exceed 100 characters" })
            .optional(),
      stateProvince: z
            .string()
            .trim()
            .max(100, {
                  message: "Guest state/province cannot exceed 100 characters",
            })
            .optional(),
      zipPostalCode: z
            .string()
            .trim()
            .max(20, { message: "Guest postal code cannot exceed 20 characters" })
            .optional(),
      country: z
            .string()
            .trim()
            .max(100, { message: "Guest country cannot exceed 100 characters" })
            .optional(),
      validIdType: z.enum(ID_TYPE_ENUMS, {
            message: "Guest ID type must be a supported ID type",
      }),
      idNumber: z
            .string()
            .trim()
            .min(1, { message: "Guest ID number is required" })
            .max(50, { message: "Guest ID number cannot exceed 50 characters" }),
});

export const GuestFilterSchema = z.object({
      search: z.string().trim().min(1).max(100).optional(),
      validIdType: z.enum(ID_TYPE_ENUMS).optional(),
});

export type GuestFilterDTO = z.infer<typeof GuestFilterSchema>;

// Schema and DTO for creating
export const CreateGuestSchema = GuestSchema.omit({ guestId: true });
export type CreateGuestDTO = z.infer<typeof CreateGuestSchema>;

// Schema and DTO for updating
export const UpdateGuestSchema = GuestSchema.omit({ guestId: true }).partial();
export type UpdateGuestDTO = z.infer<typeof UpdateGuestSchema>;

// Response DTO
export type GuestResponseDTO = z.infer<typeof GuestSchema>;
