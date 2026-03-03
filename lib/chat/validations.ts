import { z } from "zod"

import { userIdSchema } from "@/lib/validations/social"

export const conversationIdSchema = z.string().cuid("Invalid conversation id.")
export const messageIdSchema = z.string().cuid("Invalid message id.")
export const messageContentSchema = z
  .string()
  .trim()
  .min(1, "Message cannot be empty.")
  .max(1000, "Message must be 1000 characters or less.")
export const optionalMessageContentSchema = z
  .string()
  .trim()
  .max(1000, "Message must be 1000 characters or less.")
  .optional()
  .transform((value) => (value ? value : null))
export const messageKindSchema = z.enum(["TEXT", "VIDEO_SHARE"])
export const videoIdSchema = z.string().cuid("Invalid video id.")
export const CHAT_REACTION_EMOJIS = ["❤️", "😂", "🔥", "👍", "👀"] as const
export const reactionEmojiSchema = z.enum(CHAT_REACTION_EMOJIS)
export const sharedVideoUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid video URL.")
  .refine((value) => {
    try {
      const url = new URL(value)
      const pathname = url.pathname.replace(/\/+$/, "")
      const segments = pathname.split("/").filter(Boolean)

      return segments.length === 2 && segments[0] === "v" && videoIdSchema.safeParse(segments[1]).success
    } catch {
      return false
    }
  }, "Use a video URL like /v/[id].")

export const sendMessageInputSchema = z
  .object({
    conversationId: conversationIdSchema.optional(),
    recipientId: userIdSchema.optional(),
    kind: messageKindSchema.default("TEXT"),
    content: optionalMessageContentSchema,
    videoId: videoIdSchema.optional(),
    clientMessageId: z.string().trim().min(1).max(100).optional(),
  })
  .refine((value) => Boolean(value.conversationId || value.recipientId), {
    message: "A conversation or recipient is required.",
    path: ["conversationId"],
  })
  .superRefine((value, ctx) => {
    if (value.kind === "TEXT" && !value.content) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Message cannot be empty.",
      })
    }

    if (value.kind === "VIDEO_SHARE" && !value.videoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["videoId"],
        message: "Choose a video to share.",
      })
    }
  })

export const typingEventSchema = z.object({
  conversationId: conversationIdSchema,
})

export const markReadInputSchema = z.object({
  conversationId: conversationIdSchema,
  messageId: messageIdSchema.optional(),
})

export const toggleReactionInputSchema = z.object({
  messageId: messageIdSchema,
  emoji: reactionEmojiSchema,
})

export function parseVideoIdFromUrl(value: string) {
  const parsed = sharedVideoUrlSchema.safeParse(value)

  if (!parsed.success) {
    return null
  }

  const url = new URL(parsed.data)
  const segments = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean)

  return segments[1] ?? null
}
