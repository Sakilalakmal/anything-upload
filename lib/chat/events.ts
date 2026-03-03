import { z } from "zod"

import {
  conversationIdSchema,
  markReadInputSchema,
  messageIdSchema,
  messageKindSchema,
  sendMessageInputSchema,
  toggleReactionInputSchema,
  typingEventSchema,
  videoIdSchema,
} from "@/lib/chat/validations"
import { userIdSchema } from "@/lib/validations/social"

const chatUserSchema = z.object({
  id: userIdSchema,
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  image: z.string().nullable(),
  lastSeenAt: z.string().nullable().optional(),
})

const chatReactionSummarySchema = z.object({
  emoji: z.string().max(8),
  count: z.number().int().nonnegative(),
  userIds: z.array(userIdSchema),
})

const chatVideoPreviewSchema = z.object({
  id: videoIdSchema,
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
  createdAt: z.string(),
  creator: chatUserSchema,
})

const chatMessageSchema = z.object({
  id: messageIdSchema,
  conversationId: conversationIdSchema,
  senderId: userIdSchema,
  kind: messageKindSchema,
  content: z.string().nullable(),
  videoId: videoIdSchema.nullable(),
  video: chatVideoPreviewSchema.nullable(),
  reactions: z.array(chatReactionSummarySchema),
  createdAt: z.string(),
})

const chatMessagePreviewSchema = z.object({
  id: messageIdSchema,
  conversationId: conversationIdSchema,
  senderId: userIdSchema,
  kind: messageKindSchema,
  content: z.string().nullable(),
  videoId: videoIdSchema.nullable(),
  createdAt: z.string(),
})

const inboxConversationSchema = z.object({
  id: conversationIdSchema,
  otherUser: chatUserSchema,
  lastMessageAt: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
  lastMessage: chatMessagePreviewSchema.nullable(),
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
  z.object({
    type: z.literal("reaction:toggle"),
    data: toggleReactionInputSchema,
  }),
  z.object({
    type: z.literal("presence:heartbeat"),
    data: z.object({}).optional().default({}),
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
    type: z.literal("message:seen"),
    data: z.object({
      conversationId: conversationIdSchema,
      userId: userIdSchema,
      messageId: messageIdSchema.nullable(),
      lastReadAt: z.string().nullable(),
    }),
  }),
  z.object({
    type: z.literal("reaction:update"),
    data: z.object({
      messageId: messageIdSchema,
      reactionsSummary: z.array(chatReactionSummarySchema),
    }),
  }),
  z.object({
    type: z.literal("presence:update"),
    data: z.object({
      userId: userIdSchema,
      isOnline: z.boolean(),
      lastSeenAt: z.string().nullable(),
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
