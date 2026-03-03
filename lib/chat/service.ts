import { Prisma } from "@prisma/client"

import type { ChatConversation, ChatMessage, InboxConversationItem, MessagesPagePayload } from "@/lib/chat/types"
import { conversationIdSchema, markReadInputSchema, messageIdSchema, sendMessageInputSchema } from "@/lib/chat/validations"
import { decodeCursor, normalizeLimit, toCursorPage } from "@/lib/data/pagination"
import { prisma } from "@/lib/prisma"
import { userIdSchema } from "@/lib/validations/social"

const DEFAULT_MESSAGES_PAGE_SIZE = 30
const CHAT_TABLE_NAMES = ["Conversation", "ConversationMember", "Message", "MessageRead"] as const

const chatUserSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  image: true,
} satisfies Prisma.UserSelect

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  createdAt: true,
} satisfies Prisma.MessageSelect

const conversationSelect = {
  id: true,
  dedupeKey: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  members: {
    select: {
      userId: true,
      user: {
        select: chatUserSelect,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  reads: {
    select: {
      userId: true,
      lastReadAt: true,
    },
  },
} satisfies Prisma.ConversationSelect

type ConversationRecord = Prisma.ConversationGetPayload<{
  select: typeof conversationSelect
}>

type MessageRecord = Prisma.MessageGetPayload<{
  select: typeof messageSelect
}>

type InboxRow = {
  id: string
  lastMessageAt: Date | null
  currentUserLastReadAt: Date | null
  otherUserLastReadAt: Date | null
  unreadCount: number
  otherUserId: string
  otherUserName: string | null
  otherUsername: string | null
  otherAvatarUrl: string | null
  otherImage: string | null
  lastMessageId: string | null
  lastMessageConversationId: string | null
  lastMessageSenderId: string | null
  lastMessageContent: string | null
  lastMessageCreatedAt: Date | null
}

function toChatMessage(message: MessageRecord): ChatMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }
}

function buildDedupeKey(userAId: string, userBId: string) {
  return `dm:${[userAId, userBId].sort().join(":")}`
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function hasMissingChatTableMessage(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes("does not exist") &&
    CHAT_TABLE_NAMES.some((tableName) => normalized.includes(tableName.toLowerCase()))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isMissingChatTablesError(error: unknown): boolean {
  if (typeof error === "string") {
    return hasMissingChatTableMessage(error)
  }

  if (!isRecord(error)) {
    return false
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return true
    }

    if (error.code === "P2010") {
      const meta = isRecord(error.meta) ? error.meta : null
      const metaCode = typeof meta?.code === "string" ? meta.code : null
      const metaMessage = typeof meta?.message === "string" ? meta.message : null

      return metaCode === "42P01" || (metaMessage ? hasMissingChatTableMessage(metaMessage) : false)
    }
  }

  if (error instanceof Error) {
    return hasMissingChatTableMessage(error.message) || isMissingChatTablesError(error.cause)
  }

  return Object.values(error).some((value) => isMissingChatTablesError(value))
}

function createMissingChatTablesError() {
  return new Error("Chat database tables are missing. Run `npx prisma migrate dev --name phase9_chat`.")
}

function toChatConversation(conversation: ConversationRecord, viewerId: string): ChatConversation {
  const otherMember = conversation.members.find((member) => member.userId !== viewerId)

  if (!otherMember) {
    throw new Error("Conversation is missing the other participant.")
  }

  const currentRead = conversation.reads.find((read) => read.userId === viewerId)
  const otherRead = conversation.reads.find((read) => read.userId === otherMember.userId)

  return {
    id: conversation.id,
    dedupeKey: conversation.dedupeKey,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    otherUser: {
      id: otherMember.user.id,
      name: otherMember.user.name,
      username: otherMember.user.username,
      avatarUrl: otherMember.user.avatarUrl,
      image: otherMember.user.image,
    },
    memberIds: conversation.members.map((member) => member.userId),
    currentUserLastReadAt: currentRead?.lastReadAt.toISOString() ?? null,
    otherUserLastReadAt: otherRead?.lastReadAt.toISOString() ?? null,
  }
}

function toInboxConversation(row: InboxRow): InboxConversationItem {
  return {
    id: row.id,
    otherUser: {
      id: row.otherUserId,
      name: row.otherUserName,
      username: row.otherUsername,
      avatarUrl: row.otherAvatarUrl,
      image: row.otherImage,
    },
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    unreadCount: row.unreadCount,
    lastMessage:
      row.lastMessageId &&
      row.lastMessageConversationId &&
      row.lastMessageSenderId &&
      row.lastMessageContent &&
      row.lastMessageCreatedAt
        ? {
            id: row.lastMessageId,
            conversationId: row.lastMessageConversationId,
            senderId: row.lastMessageSenderId,
            content: row.lastMessageContent,
            createdAt: row.lastMessageCreatedAt.toISOString(),
          }
        : null,
    currentUserLastReadAt: row.currentUserLastReadAt?.toISOString() ?? null,
    otherUserLastReadAt: row.otherUserLastReadAt?.toISOString() ?? null,
  }
}

async function assertConversationMember(conversationId: string, userId: string) {
  try {
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: {
        conversationId: true,
      },
    })

    if (!membership) {
      throw new Error("Conversation not found.")
    }
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      throw createMissingChatTablesError()
    }

    throw error
  }
}

async function getInboxRows(userId: string, conversationId?: string) {
  try {
    return await prisma.$queryRaw<InboxRow[]>(Prisma.sql`
      SELECT
        c."id",
        c."lastMessageAt",
        current_read."lastReadAt" AS "currentUserLastReadAt",
        other_read."lastReadAt" AS "otherUserLastReadAt",
        COALESCE(COUNT(unread_messages."id"), 0)::int AS "unreadCount",
        other_user."id" AS "otherUserId",
        other_user."name" AS "otherUserName",
        other_user."username" AS "otherUsername",
        other_user."avatarUrl" AS "otherAvatarUrl",
        other_user."image" AS "otherImage",
        last_message."id" AS "lastMessageId",
        last_message."conversationId" AS "lastMessageConversationId",
        last_message."senderId" AS "lastMessageSenderId",
        last_message."content" AS "lastMessageContent",
        last_message."createdAt" AS "lastMessageCreatedAt"
      FROM "ConversationMember" member
      INNER JOIN "Conversation" c
        ON c."id" = member."conversationId"
      INNER JOIN "ConversationMember" other_member
        ON other_member."conversationId" = c."id"
        AND other_member."userId" <> ${userId}
      INNER JOIN "User" other_user
        ON other_user."id" = other_member."userId"
      LEFT JOIN "MessageRead" current_read
        ON current_read."conversationId" = c."id"
        AND current_read."userId" = ${userId}
      LEFT JOIN "MessageRead" other_read
        ON other_read."conversationId" = c."id"
        AND other_read."userId" = other_user."id"
      LEFT JOIN LATERAL (
        SELECT
          message."id",
          message."conversationId",
          message."senderId",
          message."content",
          message."createdAt"
        FROM "Message" message
        WHERE message."conversationId" = c."id"
        ORDER BY message."createdAt" DESC, message."id" DESC
        LIMIT 1
      ) last_message ON true
      LEFT JOIN "Message" unread_messages
        ON unread_messages."conversationId" = c."id"
        AND unread_messages."senderId" <> ${userId}
        AND unread_messages."createdAt" > COALESCE(current_read."lastReadAt", to_timestamp(0))
      WHERE member."userId" = ${userId}
        ${conversationId ? Prisma.sql`AND c."id" = ${conversationId}` : Prisma.empty}
      GROUP BY
        c."id",
        c."lastMessageAt",
        current_read."lastReadAt",
        other_read."lastReadAt",
        other_user."id",
        other_user."name",
        other_user."username",
        other_user."avatarUrl",
        other_user."image",
        last_message."id",
        last_message."conversationId",
        last_message."senderId",
        last_message."content",
        last_message."createdAt"
      ORDER BY c."lastMessageAt" DESC NULLS LAST, c."updatedAt" DESC, c."id" DESC
    `)
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return []
    }

    throw error
  }
}

export async function getUnreadMessageCount(userId: string) {
  const parsedUserId = userIdSchema.parse(userId)
  let result: { unreadCount: number } | undefined

  try {
    ;[result] = await prisma.$queryRaw<Array<{ unreadCount: number }>>(Prisma.sql`
      SELECT COALESCE(COUNT(message."id"), 0)::int AS "unreadCount"
      FROM "Message" message
      INNER JOIN "ConversationMember" member
        ON member."conversationId" = message."conversationId"
        AND member."userId" = ${parsedUserId}
      LEFT JOIN "MessageRead" read_state
        ON read_state."conversationId" = message."conversationId"
        AND read_state."userId" = ${parsedUserId}
      WHERE message."senderId" <> ${parsedUserId}
        AND message."createdAt" > COALESCE(read_state."lastReadAt", to_timestamp(0))
    `)
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return 0
    }

    throw error
  }

  return result?.unreadCount ?? 0
}

export async function getInboxConversations(userId: string) {
  const parsedUserId = userIdSchema.parse(userId)
  const rows = await getInboxRows(parsedUserId)
  return rows.map(toInboxConversation)
}

export async function getInboxConversation(conversationId: string, userId: string) {
  const parsedConversationId = conversationIdSchema.parse(conversationId)
  const parsedUserId = userIdSchema.parse(userId)
  const rows = await getInboxRows(parsedUserId, parsedConversationId)
  return rows[0] ? toInboxConversation(rows[0]) : null
}

export async function createOrGetConversationForUsers(currentUserId: string, otherUserId: string) {
  const parsedCurrentUserId = userIdSchema.parse(currentUserId)
  const parsedOtherUserId = userIdSchema.parse(otherUserId)

  if (parsedCurrentUserId === parsedOtherUserId) {
    throw new Error("You cannot start a conversation with yourself.")
  }

  const otherUser = await prisma.user.findUnique({
    where: {
      id: parsedOtherUserId,
    },
    select: {
      id: true,
    },
  })

  if (!otherUser) {
    throw new Error("User not found.")
  }

  const dedupeKey = buildDedupeKey(parsedCurrentUserId, parsedOtherUserId)

  let existingConversation: ConversationRecord | null

  try {
    existingConversation = await prisma.conversation.findUnique({
      where: {
        dedupeKey,
      },
      select: conversationSelect,
    })
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      throw createMissingChatTablesError()
    }

    throw error
  }

  if (existingConversation) {
    return toChatConversation(existingConversation, parsedCurrentUserId)
  }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        dedupeKey,
        members: {
          create: [{ userId: parsedCurrentUserId }, { userId: parsedOtherUserId }],
        },
      },
      select: conversationSelect,
    })

    return toChatConversation(conversation, parsedCurrentUserId)
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      throw createMissingChatTablesError()
    }

    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const dedupedConversation = await prisma.conversation.findUnique({
      where: {
        dedupeKey,
      },
      select: conversationSelect,
    })

    if (!dedupedConversation) {
      throw error
    }

    return toChatConversation(dedupedConversation, parsedCurrentUserId)
  }
}

export async function getConversation(conversationId: string, userId: string) {
  const parsedConversationId = conversationIdSchema.parse(conversationId)
  const parsedUserId = userIdSchema.parse(userId)

  let conversation: ConversationRecord | null

  try {
    conversation = await prisma.conversation.findFirst({
      where: {
        id: parsedConversationId,
        members: {
          some: {
            userId: parsedUserId,
          },
        },
      },
      select: conversationSelect,
    })
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return null
    }

    throw error
  }

  if (!conversation) {
    return null
  }

  return toChatConversation(conversation, parsedUserId)
}

export async function getMessages({
  conversationId,
  userId,
  cursor,
  limit,
}: {
  conversationId: string
  userId: string
  cursor?: string | null
  limit?: number
}): Promise<MessagesPagePayload> {
  const parsedConversationId = conversationIdSchema.parse(conversationId)
  const parsedUserId = userIdSchema.parse(userId)
  const take = normalizeLimit(limit, DEFAULT_MESSAGES_PAGE_SIZE)
  const parsedCursor = decodeCursor(cursor)

  try {
    await assertConversationMember(parsedConversationId, parsedUserId)

    const messages = await prisma.message.findMany({
      where: {
        conversationId: parsedConversationId,
        ...(parsedCursor
          ? {
              OR: [
                {
                  createdAt: {
                    lt: parsedCursor.createdAt,
                  },
                },
                {
                  createdAt: parsedCursor.createdAt,
                  id: {
                    lt: parsedCursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: messageSelect,
    })

    const page = toCursorPage(messages, take)

    return {
      items: page.items.reverse().map(toChatMessage),
      nextCursor: page.nextCursor,
    }
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return {
        items: [],
        nextCursor: null,
      }
    }

    throw error
  }
}

export async function sendMessageFromUser(input: {
  senderId: string
  conversationId?: string
  recipientId?: string
  content: string
}) {
  const parsed = sendMessageInputSchema.parse(input)
  const parsedSenderId = userIdSchema.parse(input.senderId)

  const conversation =
    parsed.conversationId
      ? await getConversation(parsed.conversationId, parsedSenderId)
      : await createOrGetConversationForUsers(parsedSenderId, parsed.recipientId!)

  if (!conversation) {
    throw new Error("Conversation not found.")
  }

  let createdMessage: MessageRecord

  try {
    createdMessage = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: parsedSenderId,
          content: parsed.content,
        },
        select: messageSelect,
      })

      await Promise.all([
        tx.conversation.update({
          where: {
            id: conversation.id,
          },
          data: {
            lastMessageAt: message.createdAt,
          },
        }),
        tx.messageRead.upsert({
          where: {
            conversationId_userId: {
              conversationId: conversation.id,
              userId: parsedSenderId,
            },
          },
          update: {
            lastReadAt: message.createdAt,
          },
          create: {
            conversationId: conversation.id,
            userId: parsedSenderId,
            lastReadAt: message.createdAt,
          },
        }),
      ])

      return message
    })
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      throw createMissingChatTablesError()
    }

    throw error
  }

  const nextConversation = await getConversation(conversation.id, parsedSenderId)

  if (!nextConversation) {
    throw new Error("Conversation not found after sending a message.")
  }

  return {
    conversation: nextConversation,
    message: toChatMessage(createdMessage),
  }
}

export async function markConversationReadForUser(input: {
  conversationId: string
  userId: string
  messageId?: string
}) {
  const parsed = markReadInputSchema.parse(input)
  const parsedUserId = userIdSchema.parse(input.userId)

  await assertConversationMember(parsed.conversationId, parsedUserId)

  let targetMessage:
    | {
        id: string
        createdAt: Date
      }
    | null

  try {
    targetMessage = parsed.messageId
      ? await prisma.message.findFirst({
          where: {
            id: parsed.messageId,
            conversationId: parsed.conversationId,
          },
          select: {
            id: true,
            createdAt: true,
          },
        })
      : await prisma.message.findFirst({
          where: {
            conversationId: parsed.conversationId,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            createdAt: true,
          },
        })
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      throw createMissingChatTablesError()
    }

    throw error
  }

  if (!targetMessage) {
    return {
      conversationId: parsed.conversationId,
      messageId: null,
      lastReadAt: null,
    }
  }

  let existing: {
    lastReadAt: Date
  } | null

  try {
    existing = await prisma.messageRead.findUnique({
      where: {
        conversationId_userId: {
          conversationId: parsed.conversationId,
          userId: parsedUserId,
        },
      },
      select: {
        lastReadAt: true,
      },
    })
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      throw createMissingChatTablesError()
    }

    throw error
  }

  const lastReadAt =
    existing && existing.lastReadAt > targetMessage.createdAt ? existing.lastReadAt : targetMessage.createdAt

  try {
    await prisma.messageRead.upsert({
      where: {
        conversationId_userId: {
          conversationId: parsed.conversationId,
          userId: parsedUserId,
        },
      },
      update: {
        lastReadAt,
      },
      create: {
        conversationId: parsed.conversationId,
        userId: parsedUserId,
        lastReadAt,
      },
    })
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      throw createMissingChatTablesError()
    }

    throw error
  }

  return {
    conversationId: parsed.conversationId,
    messageId: targetMessage.id,
    lastReadAt: lastReadAt.toISOString(),
  }
}

export async function getMessageById(messageId: string, conversationId: string, userId: string) {
  const parsedMessageId = messageIdSchema.parse(messageId)
  const parsedConversationId = conversationIdSchema.parse(conversationId)
  const parsedUserId = userIdSchema.parse(userId)

  await assertConversationMember(parsedConversationId, parsedUserId)

  let message: MessageRecord | null

  try {
    message = await prisma.message.findFirst({
      where: {
        id: parsedMessageId,
        conversationId: parsedConversationId,
      },
      select: messageSelect,
    })
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return null
    }

    throw error
  }

  return message ? toChatMessage(message) : null
}
