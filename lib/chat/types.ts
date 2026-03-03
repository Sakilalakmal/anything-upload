export type ChatUserSummary = {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
  image: string | null
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
}

export type ChatConversation = {
  id: string
  dedupeKey: string
  createdAt: string
  updatedAt: string
  lastMessageAt: string | null
  otherUser: ChatUserSummary
  memberIds: string[]
  currentUserLastReadAt: string | null
  otherUserLastReadAt: string | null
}

export type InboxConversationItem = {
  id: string
  otherUser: ChatUserSummary
  lastMessageAt: string | null
  unreadCount: number
  lastMessage: ChatMessage | null
  currentUserLastReadAt: string | null
  otherUserLastReadAt: string | null
}

export type MessagesPagePayload = {
  items: ChatMessage[]
  nextCursor: string | null
}
