import { z } from "zod";

export const KuboTypeSchema = z.object({
      kuboTypeId: z.string().uuid(),
      kuboTypeName: z.string({ message: "Kubo type name is required" }),
      kuboTypeCapacity: z
            .number({
                  message: "Kubo type capacity is required and is a valid number value",
            })
            .positive(),
      pricePerNight: z
            .number({
                  message: "Kubo type price per night is required and is a valid decimal(pricing) format",
            })
            .positive()
            .finite(),
      kuboTypeDescription: z.string({
            message: "Kubo description is required",
      }),
});

// Schema and DTO for creating
export const CreateKuboTypeSchema = KuboTypeSchema.omit({ kuboTypeId: true });
export type CreateKuboTypeDTO = z.infer<typeof CreateKuboTypeSchema>;

// Schema and DTO for updating
export const UpdateKuboTypeSchema = KuboTypeSchema.pick({
      kuboTypeId: true,
}).merge(KuboTypeSchema.omit({ kuboTypeId: true }).partial());
export type UpdateKuboTypeDTO = z.infer<typeof UpdateKuboTypeSchema>;

// Response DTO
export type KuboTypeResponseDTO = z.infer<typeof CreateKuboTypeSchema>;
