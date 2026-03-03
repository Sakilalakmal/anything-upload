import { z } from "zod"

import { conversationIdSchema, markReadInputSchema, messageContentSchema, messageIdSchema, sendMessageInputSchema, typingEventSchema } from "@/lib/chat/validations"
import { userIdSchema } from "@/lib/validations/social"

const chatUserSchema = z.object({
  id: userIdSchema,
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  image: z.string().nullable(),
})

const chatMessageSchema = z.object({
  id: messageIdSchema,
  conversationId: conversationIdSchema,
  senderId: userIdSchema,
  content: messageContentSchema,
  createdAt: z.string(),
})

const inboxConversationSchema = z.object({
  id: conversationIdSchema,
  otherUser: chatUserSchema,
  lastMessageAt: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
  lastMessage: chatMessageSchema.nullable(),
  currentUserLastReadAt: z.string().nullable(),
  otherUserLastReadAt: z.string().nullable(),
})

export const chatClientEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message:send"),
    data: sendMessageInputSchema,
  }),
  z.object({
    type: z.literal("typing:start"),
    data: typingEventSchema,
  }),
  z.object({
    type: z.literal("typing:stop"),
    data: typingEventSchema,
  }),
  z.object({
    type: z.literal("message:read"),
    data: markReadInputSchema,
  }),
])

export const chatServerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message:new"),
    data: z.object({
      conversationId: conversationIdSchema,
      clientMessageId: z.string().nullable().optional(),
      message: chatMessageSchema,
    }),
  }),
  z.object({
    type: z.literal("typing"),
    data: z.object({
      conversationId: conversationIdSchema,
      userId: userIdSchema,
      isTyping: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal("message:read"),
    data: z.object({
      conversationId: conversationIdSchema,
      userId: userIdSchema,
      messageId: messageIdSchema.nullable(),
      lastReadAt: z.string().nullable(),
    }),
  }),
  z.object({
    type: z.literal("inbox:update"),
    data: z.object({
      conversation: inboxConversationSchema,
      totalUnreadCount: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    type: z.literal("error"),
    data: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
])

export type ChatClientEvent = z.infer<typeof chatClientEventSchema>
export type ChatServerEvent = z.infer<typeof chatServerEventSchema>
