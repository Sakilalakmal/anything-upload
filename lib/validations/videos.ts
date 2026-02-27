import { z } from "zod"

export const videoVisibilitySchema = z.enum(["PUBLIC", "UNLISTED", "PRIVATE"])

export const createVideoMetadataSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160, "Title must be 160 characters or less."),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be 2000 characters or less.")
    .optional()
    .transform((value) => (value ? value : null)),
  visibility: videoVisibilitySchema.default("PUBLIC"),
})

export type CreateVideoMetadataInput = z.infer<typeof createVideoMetadataSchema>
