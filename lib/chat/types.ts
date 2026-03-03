export type ChatUserSummary = {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
  image: string | null
  lastSeenAt?: string | null
}

export type ChatMessageReactionSummary = {
  emoji: string
  count: number
  userIds: string[]
}

export type ChatVideoSharePreview = {
  id: string
  title: string
  thumbnailUrl: string | null
  createdAt: string
  creator: ChatUserSummary
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  kind: "TEXT" | "VIDEO_SHARE"
  content: string | null
  videoId: string | null
  video: ChatVideoSharePreview | null
  reactions: ChatMessageReactionSummary[]
  createdAt: string
}

export type ChatMessagePreview = Pick<
  ChatMessage,
  "id" | "conversationId" | "senderId" | "kind" | "content" | "videoId" | "createdAt"
>

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

export type PresenceState = {
  userId: string
  isOnline: boolean
  lastSeenAt: string | null
}

export type InboxConversationItem = {
  id: string
  otherUser: ChatUserSummary
  lastMessageAt: string | null
  unreadCount: number
  lastMessage: ChatMessagePreview | null
  currentUserLastReadAt: string | null
  otherUserLastReadAt: string | null
}

export type MessagesPagePayload = {
  items: ChatMessage[]
  nextCursor: string | null
}
