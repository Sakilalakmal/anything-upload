import "server-only"

import { requireUserOrThrow } from "@/lib/auth-guards"
import {
  createOrGetConversationForUsers,
  getConversation,
  getInboxConversation,
  getInboxConversations,
  getMessages as getMessagesPage,
  getUnreadMessageCount,
  markConversationReadForUser,
  sendMessageFromUser,
} from "@/lib/chat/service"

export {
  getConversation,
  getInboxConversation,
  getInboxConversations,
  getUnreadMessageCount,
}

export async function getMessages(conversationId: string, cursor?: string | null) {
  const user = await requireUserOrThrow()

  return getMessagesPage({
    conversationId,
    userId: user.id,
    cursor,
  })
}

export async function createOrGetConversation(otherUserId: string) {
  const user = await requireUserOrThrow()
  return createOrGetConversationForUsers(user.id, otherUserId)
}

export async function sendMessage(conversationId: string, content: string) {
  const user = await requireUserOrThrow()
  return sendMessageFromUser({
    senderId: user.id,
    conversationId,
    content,
  })
}

export async function markConversationRead(conversationId: string, messageId?: string) {
  const user = await requireUserOrThrow()
  return markConversationReadForUser({
    conversationId,
    userId: user.id,
    messageId,
  })
}
