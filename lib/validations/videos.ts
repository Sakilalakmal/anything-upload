import { z } from "zod"

export const videoVisibilitySchema = z.enum(["PUBLIC", "UNLISTED", "PRIVATE"])

export const videoTitleSchema = z.string().trim().min(1, "Title is required.").max(160, "Title must be 160 characters or less.")

export const videoDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description must be 2000 characters or less.")
  .optional()
  .transform((value) => (value ? value : null))

export const createVideoMetadataSchema = z.object({
  title: videoTitleSchema,
  description: videoDescriptionSchema,
  visibility: videoVisibilitySchema.default("PUBLIC"),
})

const uploadthingVideoUrlSchema = z
  .string()
  .trim()
  .min(1, "Video URL is required.")
  .url("Video URL must be a valid URL.")
  .refine((value) => {
    const { hostname } = new URL(value)
    return (
      hostname === "ufs.sh" ||
      hostname.endsWith(".ufs.sh") ||
      hostname === "utfs.io" ||
      hostname.endsWith(".utfs.io")
    )
  }, "Video URL must be from UploadThing.")

export const createVideoAfterUploadSchema = z.object({
  title: videoTitleSchema,
  description: videoDescriptionSchema,
  videoUrl: uploadthingVideoUrlSchema,
  uploadedBy: z.string().trim().min(1, "Invalid uploader id."),
})

export type CreateVideoMetadataInput = z.infer<typeof createVideoMetadataSchema>
export type CreateVideoAfterUploadInput = z.infer<typeof createVideoAfterUploadSchema>
