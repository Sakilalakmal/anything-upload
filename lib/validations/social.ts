import { z } from "zod"

export const videoIdSchema = z.string().cuid("Invalid video id.")
export const userIdSchema = z.string().cuid("Invalid user id.")
export const commentIdSchema = z.string().cuid("Invalid comment id.")
export const commentContentSchema = z
  .string()
  .trim()
  .min(1, "Comment cannot be empty.")
  .max(500, "Comment must be 500 characters or less.")

export const addCommentSchema = z.object({
  videoId: videoIdSchema,
  content: commentContentSchema,
})

export const toggleLikeSchema = z.object({
  videoId: videoIdSchema,
})

export const toggleFollowSchema = z.object({
  targetUserId: userIdSchema,
})

export type AddCommentInput = z.infer<typeof addCommentSchema>
