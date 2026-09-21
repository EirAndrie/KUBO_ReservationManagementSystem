import { z } from "zod";

const ROOM_STATUS = [
      "available",
      "reserved",
      "occupied",
      "maintenance",
      "out of service",
      "cleaning",
      "under inspection",
] as const;

export const KuboSchema = z.object({
      kuboId: z.string().uuid(),
      kuboTypeId: z.string().uuid({
            message: "Invalid kubo type id format, must be UUI to reference",
      }),
      kuboRoomNumber: z.string({ message: "Kubo room number is required" }),
      kuboStatus: z.enum(ROOM_STATUS, {
            message: "Invalid room status entry, did not follow system integrated status enums",
      }),
});

// Schema and DTO for creating
export const CreateKuboSchema = KuboSchema.omit({ kuboId: true });
export type CreateKuboDTO = z.infer<typeof CreateKuboSchema>;

// Schema and DTO for updating
export const UpdateKuboSchema = KuboSchema.pick({ kuboId: true }).merge(
      KuboSchema.omit({ kuboId: true }).partial(),
);
export type UpdateKuboDTO = z.infer<typeof UpdateKuboSchema>;

// Response DTO
export type KuboResponseDTO = z.infer<typeof CreateKuboSchema>;
