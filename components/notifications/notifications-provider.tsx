"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { z } from "zod"

import type { InboxNotificationItem } from "@/lib/data/notification-types"
import { realtimeNotificationEventSchema } from "@/lib/realtime/notifications-events"

const unreadCountResponseSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
})

const RECENT_NOTIFICATIONS_LIMIT = 20
const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const FALLBACK_REFETCH_INTERVAL_MS = 60_000

type RealtimeNotificationsContextValue = {
  unreadCount: number
  setUnreadCount: Dispatch<SetStateAction<number>>
  recentNotifications: InboxNotificationItem[]
  latestNotification: InboxNotificationItem | null
  latestNotificationTs: number | null
  latestReadNotificationId: string | null
  latestReadAt: string | null
  latestReadTs: number | null
}

const RealtimeNotificationsContext = createContext<RealtimeNotificationsContextValue | null>(null)

export function NotificationsProvider({
  initialUnreadCount,
  sessionUserId,
  children,
}: {
  initialUnreadCount: number
  sessionUserId: string | null
  children: ReactNode
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [recentNotifications, setRecentNotifications] = useState<InboxNotificationItem[]>([])
  const [latestNotification, setLatestNotification] = useState<InboxNotificationItem | null>(null)
  const [latestNotificationTs, setLatestNotificationTs] = useState<number | null>(null)
  const [latestReadNotificationId, setLatestReadNotificationId] = useState<string | null>(null)
  const [latestReadAt, setLatestReadAt] = useState<string | null>(null)
  const [latestReadTs, setLatestReadTs] = useState<number | null>(null)

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  useEffect(() => {
    setRecentNotifications([])
    setLatestNotification(null)
    setLatestNotificationTs(null)
    setLatestReadNotificationId(null)
    setLatestReadAt(null)
    setLatestReadTs(null)
  }, [sessionUserId])

  useEffect(() => {
    if (!sessionUserId || typeof window === "undefined") {
      return
    }

    let source: EventSource | null = null
    let reconnectTimer: number | null = null
    let reconnectAttempt = 0
    let disposed = false

    const closeEventSource = () => {
      if (!source) {
        return
      }

      source.close()
      source = null
    }

    const handleRealtimeMessage = (rawData: string) => {
      let payload: unknown

      try {
        payload = JSON.parse(rawData)
      } catch {
        return
      }

      const parsed = realtimeNotificationEventSchema.safeParse(payload)

      if (!parsed.success) {
        return
      }

      const realtimeEvent = parsed.data

      switch (realtimeEvent.type) {
        case "unread_count_changed":
          setUnreadCount(realtimeEvent.data.unreadCount)
          return
        case "notification_created":
          setLatestNotification(realtimeEvent.data.notification)
          setLatestNotificationTs(realtimeEvent.ts)
          setRecentNotifications((previousNotifications) => {
            const dedupedNotifications = previousNotifications.filter(
              (notification) => notification.id !== realtimeEvent.data.notification.id
            )

            return [realtimeEvent.data.notification, ...dedupedNotifications].slice(0, RECENT_NOTIFICATIONS_LIMIT)
          })
          return
        case "notification_read":
          setLatestReadNotificationId(realtimeEvent.data.notificationId)
          setLatestReadAt(realtimeEvent.data.readAt)
          setLatestReadTs(realtimeEvent.ts)
          setRecentNotifications((previousNotifications) =>
            previousNotifications.map((notification) =>
              notification.id === realtimeEvent.data.notificationId
                ? {
                    ...notification,
                    readAt: realtimeEvent.data.readAt,
                  }
                : notification
            )
          )
          return
      }
    }

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== null) {
        return
      }

      const delay =
        Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt) +
        Math.floor(Math.random() * 250)

      reconnectAttempt += 1

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connectToNotificationsStream()
      }, delay)
    }

    const connectToNotificationsStream = () => {
      if (disposed || typeof window.EventSource === "undefined") {
        return
      }

      closeEventSource()

      const nextSource = new window.EventSource("/api/realtime/notifications")

      nextSource.onopen = () => {
        reconnectAttempt = 0

        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }

      nextSource.onerror = () => {
        if (source !== nextSource || disposed) {
          return
        }

        closeEventSource()
        scheduleReconnect()
      }

      nextSource.addEventListener("unread_count_changed", (event) => {
        handleRealtimeMessage((event as MessageEvent<string>).data)
      })
      nextSource.addEventListener("notification_created", (event) => {
        handleRealtimeMessage((event as MessageEvent<string>).data)
      })
      nextSource.addEventListener("notification_read", (event) => {
        handleRealtimeMessage((event as MessageEvent<string>).data)
      })

      source = nextSource
    }

    const refetchUnreadCount = async () => {
      try {
        const response = await fetch("/api/realtime/notifications/unread-count", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        })

        if (!response.ok) {
          return
        }

        const payload = unreadCountResponseSchema.safeParse(await response.json())

        if (payload.success) {
          setUnreadCount(payload.data.unreadCount)
        }
      } catch {
        return
      }
    }

    connectToNotificationsStream()

    const fallbackInterval = window.setInterval(() => {
      void refetchUnreadCount()
    }, FALLBACK_REFETCH_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(fallbackInterval)

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      closeEventSource()
    }
  }, [sessionUserId])

  const value = useMemo(
    () => ({
      unreadCount,
      setUnreadCount,
      recentNotifications,
      latestNotification,
      latestNotificationTs,
      latestReadNotificationId,
      latestReadAt,
      latestReadTs,
    }),
    [latestNotification, latestNotificationTs, latestReadAt, latestReadNotificationId, latestReadTs, recentNotifications, unreadCount]
  )

  return <RealtimeNotificationsContext.Provider value={value}>{children}</RealtimeNotificationsContext.Provider>
}

export function useRealtimeNotifications() {
  const value = useContext(RealtimeNotificationsContext)

  if (!value) {
    throw new Error("useRealtimeNotifications must be used within NotificationsProvider.")
  }

  return value
}

export const useNotifications = useRealtimeNotifications
