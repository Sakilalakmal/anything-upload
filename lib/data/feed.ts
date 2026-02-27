import "server-only"

import { VideoStatus, VideoVisibility } from "@prisma/client"
import { formatDistanceToNow } from "date-fns"

import type { FeedPagePayload, FeedVideoItem } from "@/lib/data/feed-types"
import { decodeCursor, normalizeLimit, toCursorPage, type CursorPage } from "@/lib/data/pagination"
import { prisma } from "@/lib/prisma"

const DEFAULT_FEED_PAGE_SIZE = 5

type FeedVideoRecord = Awaited<ReturnType<typeof getFeedRows>>[number]

export type FeedQuery = {
  cursor?: string | null
  limit?: number
  viewerId?: string | null
}

export async function getFeedPage(query: FeedQuery = {}): Promise<CursorPage<FeedVideoRecord>> {
  const limit = normalizeLimit(query.limit, DEFAULT_FEED_PAGE_SIZE)
  const parsedCursor = decodeCursor(query.cursor)
  const videos = await getFeedRows({
    limit,
    parsedCursor,
    viewerId: query.viewerId ?? null,
  })

  return toCursorPage(videos, limit)
}

function toFeedVideoItem(video: FeedVideoRecord): FeedVideoItem {
  return {
    id: video.id,
    title: video.title,
    videoUrl: video.videoUrl as string,
    thumbnailUrl: video.thumbnailUrl,
    createdAt: video.createdAt.toISOString(),
    createdAtRelative: formatDistanceToNow(video.createdAt, { addSuffix: true }),
    creator: {
      id: video.user.id,
      username: video.user.username,
      name: video.user.name,
      avatarUrl: video.user.avatarUrl,
    },
    likeCount: video._count.likes,
    commentCount: video._count.comments,
    viewerLiked: video.likes.length > 0,
  }
}

export function serializeFeedPage(page: CursorPage<FeedVideoRecord>): FeedPagePayload {
  return {
    items: page.items.map(toFeedVideoItem),
    nextCursor: page.nextCursor,
  }
}

async function getFeedRows({
  limit,
  parsedCursor,
  viewerId,
}: {
  limit: number
  parsedCursor: ReturnType<typeof decodeCursor>
  viewerId: string | null
}) {
  return prisma.video.findMany({
    where: {
      visibility: VideoVisibility.PUBLIC,
      status: VideoStatus.READY,
      videoUrl: {
        not: null,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(parsedCursor
      ? {
          cursor: {
            createdAt_id: {
              createdAt: parsedCursor.createdAt,
              id: parsedCursor.id,
            },
          },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      title: true,
      videoUrl: true,
      thumbnailUrl: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
        },
      },
      likes: {
        where: {
          userId: viewerId ?? "__anonymous_viewer__",
        },
        select: {
          id: true,
        },
        take: 1,
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
  })
}
