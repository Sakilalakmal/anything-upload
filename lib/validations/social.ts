import { z } from "zod"

export const addCommentSchema = z.object({
  videoId: z.string().cuid("Invalid video id."),
  content: z.string().trim().min(1, "Comment cannot be empty.").max(500, "Comment must be 500 characters or less."),
})

export type AddCommentInput = z.infer<typeof addCommentSchema>
