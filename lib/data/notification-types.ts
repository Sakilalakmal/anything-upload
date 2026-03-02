export type InboxNotificationItem = {
  id: string
  type: "LIKE" | "COMMENT" | "FOLLOW"
  readAt: string | null
  createdAt: string
  createdAtRelative: string
  href: string | null
  actor: {
    id: string
    name: string | null
    username: string | null
    avatarUrl: string | null
  }
  video: {
    id: string
    title: string
  } | null
  commentPreview: string | null
}

export type NotificationsPagePayload = {
  items: InboxNotificationItem[]
  nextCursor: string | null
}
