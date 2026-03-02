import { z } from "zod"

const inboxNotificationActorSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

const inboxNotificationVideoSchema = z
  .object({
    id: z.string().cuid(),
    title: z.string(),
  })
  .nullable()

export const inboxNotificationItemSchema = z.object({
  id: z.string().cuid(),
  type: z.enum(["LIKE", "COMMENT", "FOLLOW"]),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  createdAtRelative: z.string(),
  href: z.string().nullable(),
  actor: inboxNotificationActorSchema,
  video: inboxNotificationVideoSchema,
  commentPreview: z.string().nullable(),
})

export const unreadCountChangedEventSchema = z.object({
  type: z.literal("unread_count_changed"),
  data: z.object({
    unreadCount: z.number().int().nonnegative(),
  }),
  ts: z.number().int().nonnegative(),
})

export const notificationCreatedEventSchema = z.object({
  type: z.literal("notification_created"),
  data: z.object({
    notification: inboxNotificationItemSchema,
  }),
  ts: z.number().int().nonnegative(),
})

export const notificationReadEventSchema = z.object({
  type: z.literal("notification_read"),
  data: z.object({
    notificationId: z.string().cuid(),
    readAt: z.string().datetime(),
  }),
  ts: z.number().int().nonnegative(),
})

export const realtimeNotificationEventSchema = z.discriminatedUnion("type", [
  unreadCountChangedEventSchema,
  notificationCreatedEventSchema,
  notificationReadEventSchema,
])

export type RealtimeNotificationEvent = z.infer<typeof realtimeNotificationEventSchema>

export function createUnreadCountChangedEvent(unreadCount: number): RealtimeNotificationEvent {
  return unreadCountChangedEventSchema.parse({
    type: "unread_count_changed",
    data: {
      unreadCount,
    },
    ts: Date.now(),
  })
}

export function createNotificationCreatedEvent(notification: z.infer<typeof inboxNotificationItemSchema>): RealtimeNotificationEvent {
  return notificationCreatedEventSchema.parse({
    type: "notification_created",
    data: {
      notification,
    },
    ts: Date.now(),
  })
}

export function createNotificationReadEvent(notificationId: string, readAt: string): RealtimeNotificationEvent {
  return notificationReadEventSchema.parse({
    type: "notification_read",
    data: {
      notificationId,
      readAt,
    },
    ts: Date.now(),
  })
}
