import { z } from "zod"

import { userIdSchema } from "@/lib/validations/social"

export const conversationIdSchema = z.string().cuid("Invalid conversation id.")
export const messageIdSchema = z.string().cuid("Invalid message id.")
export const messageContentSchema = z
  .string()
  .trim()
  .min(1, "Message cannot be empty.")
  .max(1000, "Message must be 1000 characters or less.")

export const sendMessageInputSchema = z
  .object({
    conversationId: conversationIdSchema.optional(),
    recipientId: userIdSchema.optional(),
    content: messageContentSchema,
    clientMessageId: z.string().trim().min(1).max(100).optional(),
  })
  .refine((value) => Boolean(value.conversationId || value.recipientId), {
    message: "A conversation or recipient is required.",
    path: ["conversationId"],
  })

export const typingEventSchema = z.object({
  conversationId: conversationIdSchema,
})

export const markReadInputSchema = z.object({
  conversationId: conversationIdSchema,
  messageId: messageIdSchema.optional(),
})
