import "server-only"

import { NotificationType, Prisma } from "@prisma/client"
import { formatDistanceToNow } from "date-fns"

import { decodeCursor, normalizeLimit, toCursorPage } from "@/lib/data/pagination"
import type { InboxNotificationItem, NotificationsPagePayload } from "@/lib/data/notification-types"
import { prisma } from "@/lib/prisma"
import { commentIdSchema, userIdSchema, videoIdSchema } from "@/lib/validations/social"
import { notificationIdSchema } from "@/lib/validations/notifications"

const DEFAULT_NOTIFICATIONS_PAGE_SIZE = 20
const COMMENT_PREVIEW_MAX_LENGTH = 120

const notificationSelect = {
  id: true,
  type: true,
  readAt: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
    },
  },
  video: {
    select: {
      id: true,
      title: true,
    },
  },
  comment: {
    select: {
      id: true,
      content: true,
    },
  },
} satisfies Prisma.NotificationSelect

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect
}>

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function buildNotificationHref(notification: NotificationRecord) {
  if (notification.type === NotificationType.FOLLOW) {
    return `/u/${notification.actor.username ?? notification.actor.id}`
  }

  return notification.video?.id ? `/v/${notification.video.id}` : null
}

function getCommentPreview(content: string | null | undefined) {
  if (!content) {
    return null
  }

  const normalized = content.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return null
  }

  if (normalized.length <= COMMENT_PREVIEW_MAX_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, COMMENT_PREVIEW_MAX_LENGTH - 1).trimEnd()}...`
}

function toNotificationItem(notification: NotificationRecord): InboxNotificationItem {
  return {
    id: notification.id,
    type: notification.type,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    createdAtRelative: formatDistanceToNow(notification.createdAt, { addSuffix: true }),
    href: buildNotificationHref(notification),
    actor: {
      id: notification.actor.id,
      name: notification.actor.name,
      username: notification.actor.username,
      avatarUrl: notification.actor.avatarUrl,
    },
    video: notification.video
      ? {
          id: notification.video.id,
          title: notification.video.title,
        }
      : null,
    commentPreview: getCommentPreview(notification.comment?.content),
  }
}

async function createNotification(data: Prisma.NotificationUncheckedCreateInput) {
  try {
    return await prisma.notification.create({
      data,
      select: {
        id: true,
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null
    }

    throw error
  }
}

export async function createNotificationLike({
  actorId,
  videoId,
}: {
  actorId: string
  videoId: string
}) {
  const parsedActorId = userIdSchema.parse(actorId)
  const parsedVideoId = videoIdSchema.parse(videoId)

  const video = await prisma.video.findUnique({
    where: {
      id: parsedVideoId,
    },
    select: {
      id: true,
      userId: true,
    },
  })

  if (!video || video.userId === parsedActorId) {
    return null
  }

  return createNotification({
    type: NotificationType.LIKE,
    recipientId: video.userId,
    actorId: parsedActorId,
    videoId: video.id,
    dedupeKey: `LIKE:${video.userId}:${parsedActorId}:${video.id}`,
  })
}

export async function createNotificationComment({
  actorId,
  videoId,
  commentId,
}: {
  actorId: string
  videoId: string
  commentId: string
}) {
  const parsedActorId = userIdSchema.parse(actorId)
  const parsedVideoId = videoIdSchema.parse(videoId)
  const parsedCommentId = commentIdSchema.parse(commentId)

  const video = await prisma.video.findUnique({
    where: {
      id: parsedVideoId,
    },
    select: {
      id: true,
      userId: true,
    },
  })

  if (!video || video.userId === parsedActorId) {
    return null
  }

  return createNotification({
    type: NotificationType.COMMENT,
    recipientId: video.userId,
    actorId: parsedActorId,
    videoId: video.id,
    commentId: parsedCommentId,
  })
}

export async function createNotificationFollow({
  actorId,
  targetUserId,
}: {
  actorId: string
  targetUserId: string
}) {
  const parsedActorId = userIdSchema.parse(actorId)
  const parsedTargetUserId = userIdSchema.parse(targetUserId)

  if (parsedActorId === parsedTargetUserId) {
    return null
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      id: parsedTargetUserId,
    },
    select: {
      id: true,
    },
  })

  if (!targetUser) {
    return null
  }

  return createNotification({
    type: NotificationType.FOLLOW,
    recipientId: targetUser.id,
    actorId: parsedActorId,
    dedupeKey: `FOLLOW:${targetUser.id}:${parsedActorId}`,
  })
}

export async function getNotifications({
  recipientId,
  cursor,
  filterUnread = false,
  limit,
}: {
  recipientId: string
  cursor?: string | null
  filterUnread?: boolean
  limit?: number
}): Promise<NotificationsPagePayload> {
  const parsedRecipientId = userIdSchema.parse(recipientId)
  const parsedCursor = decodeCursor(cursor)
  const take = normalizeLimit(limit, DEFAULT_NOTIFICATIONS_PAGE_SIZE)

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: parsedRecipientId,
      ...(filterUnread
        ? {
            readAt: null,
          }
        : {}),
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
    take: take + 1,
    select: notificationSelect,
  })

  const page = toCursorPage(notifications, take)

  return {
    items: page.items.map(toNotificationItem),
    nextCursor: page.nextCursor,
  }
}

export async function getUnreadCount(recipientId: string) {
  const parsedRecipientId = userIdSchema.parse(recipientId)

  return prisma.notification.count({
    where: {
      recipientId: parsedRecipientId,
      readAt: null,
    },
  })
}

export async function markNotificationRead({
  notificationId,
  recipientId,
}: {
  notificationId: string
  recipientId: string
}) {
  const parsedNotificationId = notificationIdSchema.parse(notificationId)
  const parsedRecipientId = userIdSchema.parse(recipientId)

  const result = await prisma.notification.updateMany({
    where: {
      id: parsedNotificationId,
      recipientId: parsedRecipientId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  })

  return result.count > 0
}

export async function markAllRead(recipientId: string) {
  const parsedRecipientId = userIdSchema.parse(recipientId)

  const result = await prisma.notification.updateMany({
    where: {
      recipientId: parsedRecipientId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  })

  return result.count
}
