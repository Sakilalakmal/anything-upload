export type DiscoverTab = "videos" | "users"

export type DiscoverVideoSort = "latest" | "top"

export type DiscoverVideoItem = {
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
}

export type DiscoverUserItem = {
  id: string
  username: string | null
  name: string | null
  avatarUrl: string | null
  followersCount: number
}

export type DiscoverVideoPagePayload = {
  items: DiscoverVideoItem[]
  nextCursor: string | null
}

export type DiscoverUserPagePayload = {
  items: DiscoverUserItem[]
  nextCursor: string | null
}

export type DiscoverTagOption = {
  id: string
  name: string
  videoCount: number
}
