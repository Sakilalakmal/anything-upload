export type CommentItem = {
  id: string
  content: string
  createdAt: string
  createdAtRelative: string
  user: {
    id: string
    name: string | null
    username: string | null
    avatarUrl: string | null
  }
}

export type CommentsPagePayload = {
  items: CommentItem[]
  nextCursor: string | null
}
