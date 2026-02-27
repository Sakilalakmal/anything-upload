import "server-only"

import { VideoStatus, VideoVisibility } from "@prisma/client"
import { z } from "zod"

import { requireUser } from "@/lib/auth-guards"
import { decodeCursor, normalizeLimit, toCursorPage } from "@/lib/data/pagination"
import { prisma } from "@/lib/prisma"
import { createVideoMetadataSchema } from "@/lib/validations/videos"

const videoIdSchema = z.string().cuid("Invalid video id.")

export type FeedQuery = {
  cursor?: string | null
  limit?: number
}

export async function createVideoMetadata(input: unknown) {
  const user = await requireUser()
  const parsed = createVideoMetadataSchema.parse(input)

  return prisma.video.create({
    data: {
      userId: user.id,
      title: parsed.title,
      description: parsed.description,
      visibility: parsed.visibility,
      status: VideoStatus.PROCESSING,
    },
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      status: true,
      createdAt: true,
    },
  })
}

export async function fetchFeedPage(query: FeedQuery = {}) {
  const limit = normalizeLimit(query.limit)
  const parsedCursor = decodeCursor(query.cursor)

  const videos = await prisma.video.findMany({
    where: {
      visibility: VideoVisibility.PUBLIC,
      status: VideoStatus.READY,
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
      description: true,
      thumbnailUrl: true,
      durationSec: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
  })

  return toCursorPage(videos, limit)
}

export async function getVideoById(videoId: string, viewerId?: string | null) {
  const parsedVideoId = videoIdSchema.parse(videoId)

  const video = await prisma.video.findUnique({
    where: { id: parsedVideoId },
    select: {
      id: true,
      title: true,
      description: true,
      videoUrl: true,
      thumbnailUrl: true,
      durationSec: true,
      visibility: true,
      status: true,
      createdAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          followers: {
            where: {
              followerId: viewerId ?? "__anonymous_viewer__",
            },
            select: {
              followerId: true,
            },
            take: 1,
          },
          _count: {
            select: {
              followers: true,
            },
          },
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

  if (!video) {
    return null
  }

  const isOwner = Boolean(viewerId && video.userId === viewerId)
  const canView =
    video.visibility === VideoVisibility.PUBLIC ||
    video.visibility === VideoVisibility.UNLISTED ||
    isOwner

  return {
    ...video,
    viewerLiked: video.likes.length > 0,
    viewerFollowingCreator: video.user.followers.length > 0,
    creatorFollowerCount: video.user._count.followers,
    canView,
    isOwner,
  }
}
