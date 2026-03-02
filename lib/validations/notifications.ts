import { z } from "zod"

export const notificationIdSchema = z.string().cuid("Invalid notification id.")
export const inboxTabSchema = z.enum(["all", "unread"])
export const notificationsCursorSchema = z.string().min(1).optional()

export type InboxTab = z.infer<typeof inboxTabSchema>
