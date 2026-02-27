export type FeedVideoItem = {
  id: string
  title: string
  videoUrl: string
  thumbnailUrl: string | null
  createdAt: string
  createdAtRelative: string
  creator: {
    id: string
    username: string | null
    name: string | null
    avatarUrl: string | null
  }
  likeCount: number
  commentCount: number
  viewerLiked: boolean
}

export type FeedPagePayload = {
  items: FeedVideoItem[]
  nextCursor: string | null
}
