import "server-only"

import { Prisma, VideoVisibility } from "@prisma/client"
import { formatDistanceToNow } from "date-fns"

import { requireUserOrThrow } from "@/lib/auth-guards"
import {
  createNotificationComment,
  createNotificationFollow,
  createNotificationLike,
} from "@/lib/data/notifications"
import type { CommentItem, CommentsPagePayload } from "@/lib/data/social-types"
import { decodeCursor, normalizeLimit, toCursorPage } from "@/lib/data/pagination"
import { prisma } from "@/lib/prisma"
import { addCommentSchema, userIdSchema, videoIdSchema } from "@/lib/validations/social"

const DEFAULT_COMMENTS_PAGE_SIZE = 12
const COMMENT_RATE_LIMIT_MS = 2_000
const commentThrottleStore = new Map<string, number>()

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.CommentSelect

type CommentRecord = Prisma.CommentGetPayload<{
  select: typeof commentSelect
}>

export type CommentsQuery = {
  videoId: string
  cursor?: string | null
  limit?: number
  viewerId?: string | null
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function toCommentItem(comment: CommentRecord): CommentItem {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    createdAtRelative: formatDistanceToNow(comment.createdAt, { addSuffix: true }),
    user: {
      id: comment.user.id,
      name: comment.user.name,
      username: comment.user.username,
      avatarUrl: comment.user.avatarUrl,
    },
  }
}

function enforceCommentRateLimit(userId: string, videoId: string) {
  const now = Date.now()
  const key = `${userId}:${videoId}`
  const previous = commentThrottleStore.get(key)

  if (previous && now - previous < COMMENT_RATE_LIMIT_MS) {
    throw new Error("You are commenting too fast. Please wait a moment.")
  }

  commentThrottleStore.set(key, now)

  if (commentThrottleStore.size > 10_000) {
    for (const [entryKey, lastSeenAt] of commentThrottleStore) {
      if (now - lastSeenAt > COMMENT_RATE_LIMIT_MS * 60) {
        commentThrottleStore.delete(entryKey)
      }
    }
  }
}

async function safelyRunNotification(task: () => Promise<unknown>) {
  try {
    await task()
  } catch (error) {
    console.error("Notification write failed.", error)
  }
}

async function ensureVideoIsAccessible(videoId: string, viewerId?: string | null) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      userId: true,
      visibility: true,
    },
  })

  if (!video) {
    throw new Error("Video not found.")
  }

  const canAccess = video.visibility !== VideoVisibility.PRIVATE || video.userId === viewerId

  if (!canAccess) {
    throw new Error("You do not have access to this video.")
  }

  return video
}

export async function toggleLike(videoId: string) {
  const user = await requireUserOrThrow()
  const parsedVideoId = videoIdSchema.parse(videoId)

  await ensureVideoIsAccessible(parsedVideoId, user.id)

  const result = await prisma.$transaction(async (tx) => {
    const where = {
      userId_videoId: {
        userId: user.id,
        videoId: parsedVideoId,
      },
    }

    const existingLike = await tx.like.findUnique({
      where,
      select: { id: true },
    })

    let liked: boolean
    let shouldNotify = false

    if (existingLike) {
      await tx.like.delete({ where })
      liked = false
    } else {
      try {
        await tx.like.create({
          data: {
            userId: user.id,
            videoId: parsedVideoId,
          },
        })
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error
        }
      }

      liked = true
      shouldNotify = true
    }

    const likeCount = await tx.like.count({
      where: {
        videoId: parsedVideoId,
      },
    })

    return {
      liked,
      likeCount,
      shouldNotify,
    }
  })

  if (result.shouldNotify) {
    await safelyRunNotification(() =>
      createNotificationLike({
        actorId: user.id,
        videoId: parsedVideoId,
      })
    )
  }

  return {
    liked: result.liked,
    likeCount: result.likeCount,
  }
}

export async function createComment(input: unknown) {
  const user = await requireUserOrThrow()
  const parsed = addCommentSchema.parse(input)

  await ensureVideoIsAccessible(parsed.videoId, user.id)
  enforceCommentRateLimit(user.id, parsed.videoId)

  const createdComment = await prisma.comment.create({
    data: {
      userId: user.id,
      videoId: parsed.videoId,
      content: parsed.content,
    },
    select: commentSelect,
  })

  const commentCount = await prisma.comment.count({
    where: {
      videoId: parsed.videoId,
    },
  })

  await safelyRunNotification(() =>
    createNotificationComment({
      actorId: user.id,
      videoId: parsed.videoId,
      commentId: createdComment.id,
    })
  )

  return {
    comment: toCommentItem(createdComment),
    commentCount,
  }
}

export async function getComments(query: CommentsQuery): Promise<CommentsPagePayload> {
  const parsedVideoId = videoIdSchema.parse(query.videoId)
  const parsedCursor = decodeCursor(query.cursor)
  const limit = normalizeLimit(query.limit, DEFAULT_COMMENTS_PAGE_SIZE)

  await ensureVideoIsAccessible(parsedVideoId, query.viewerId ?? null)

  const comments = await prisma.comment.findMany({
    where: {
      videoId: parsedVideoId,
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
    take: limit + 1,
    select: commentSelect,
  })

  const page = toCursorPage(comments, limit)

  return {
    items: page.items.map(toCommentItem),
    nextCursor: page.nextCursor,
  }
}

export async function toggleFollow(targetUserId: string) {
  const user = await requireUserOrThrow()
  const parsedTargetUserId = userIdSchema.parse(targetUserId)

  if (user.id === parsedTargetUserId) {
    throw new Error("You cannot follow yourself.")
  }

  const result = await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: {
        id: parsedTargetUserId,
      },
      select: {
        id: true,
      },
    })

    if (!targetUser) {
      throw new Error("User not found.")
    }

    const where = {
      followerId_followingId: {
        followerId: user.id,
        followingId: parsedTargetUserId,
      },
    }

    const existingFollow = await tx.follow.findUnique({
      where,
      select: {
        followerId: true,
      },
    })

    let following: boolean
    let shouldNotify = false

    if (existingFollow) {
      await tx.follow.delete({ where })
      following = false
    } else {
      try {
        await tx.follow.create({
          data: {
            followerId: user.id,
            followingId: parsedTargetUserId,
          },
        })
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error
        }
      }

      following = true
      shouldNotify = true
    }

    const followerCount = await tx.follow.count({
      where: {
        followingId: parsedTargetUserId,
      },
    })

    return {
      following,
      followerCount,
      shouldNotify,
    }
  })

  if (result.shouldNotify) {
    await safelyRunNotification(() =>
      createNotificationFollow({
        actorId: user.id,
        targetUserId: parsedTargetUserId,
      })
    )
  }

  return {
    following: result.following,
    followerCount: result.followerCount,
  }
}
