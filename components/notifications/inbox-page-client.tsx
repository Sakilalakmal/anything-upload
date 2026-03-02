"use client"

import { usePathname, useRouter } from "next/navigation"
import { Heart, Inbox, Loader2, MessageCircle, UserPlus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications"
import { useNotifications } from "@/components/notifications/notifications-provider"
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { InboxNotificationItem, NotificationsPagePayload } from "@/lib/data/notification-types"
import type { InboxTab } from "@/lib/validations/notifications"
import { cn } from "@/lib/utils"

type InboxPageClientProps = {
  initialTab: InboxTab
  initialUnreadCount: number
  initialPage: NotificationsPagePayload
}

type InboxPagesState = Record<InboxTab, NotificationsPagePayload | null>

const notificationIcons = {
  LIKE: Heart,
  COMMENT: MessageCircle,
  FOLLOW: UserPlus,
} as const

function createInboxHref(pathname: string, tab: InboxTab) {
  const params = new URLSearchParams()
  params.set("tab", tab)

  return `${pathname}?${params.toString()}`
}

function formatUnreadCount(count: number) {
  if (count <= 0) {
    return "0"
  }

  return count > 99 ? "99+" : String(count)
}

function getActorDisplayName(notification: InboxNotificationItem) {
  return notification.actor.name ?? notification.actor.username ?? "Someone"
}

function getActorHandle(notification: InboxNotificationItem) {
  return `@${notification.actor.username ?? notification.actor.id.slice(0, 8)}`
}

function getNotificationActionLabel(type: InboxNotificationItem["type"]) {
  switch (type) {
    case "LIKE":
      return "liked your video"
    case "COMMENT":
      return "commented on your video"
    case "FOLLOW":
      return "followed you"
  }
}

function getNotificationContext(notification: InboxNotificationItem) {
  if (notification.type === "COMMENT") {
    return notification.commentPreview ?? notification.video?.title ?? "New comment"
  }

  if (notification.type === "LIKE") {
    return notification.video?.title ?? "Your video"
  }

  return "View profile"
}

function getNotificationIconClasses(type: InboxNotificationItem["type"]) {
  switch (type) {
    case "LIKE":
      return "bg-rose-500 text-white"
    case "COMMENT":
      return "bg-sky-500 text-white"
    case "FOLLOW":
      return "bg-emerald-500 text-white"
  }
}

function prependNotificationItems(items: InboxNotificationItem[], notification: InboxNotificationItem) {
  return [notification, ...items.filter((item) => item.id !== notification.id)]
}

function markNotificationReadInPages(
  previousPages: InboxPagesState,
  notificationId: string,
  readAt: string
): InboxPagesState {
  return {
    all: previousPages.all
      ? {
          ...previousPages.all,
          items: previousPages.all.items.map((item) =>
            item.id === notificationId && !item.readAt ? { ...item, readAt } : item
          ),
        }
      : previousPages.all,
    unread: previousPages.unread
      ? {
          ...previousPages.unread,
          items: previousPages.unread.items.filter((item) => item.id !== notificationId),
        }
      : previousPages.unread,
  }
}

export function InboxPageClient({
  initialTab,
  initialUnreadCount,
  initialPage,
}: InboxPageClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    unreadCount,
    setUnreadCount,
    latestNotification,
    latestNotificationTs,
    latestReadAt,
    latestReadNotificationId,
    latestReadTs,
  } = useNotifications()

  const [tab, setTab] = useState<InboxTab>(initialTab)
  const [pages, setPages] = useState<InboxPagesState>({
    all: initialTab === "all" ? initialPage : null,
    unread: initialTab === "unread" ? initialPage : null,
  })
  const [error, setError] = useState<string | null>(null)
  const [loadingTab, setLoadingTab] = useState<InboxTab | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const handledCreatedEventTsRef = useRef<number | null>(null)
  const handledReadEventTsRef = useRef<number | null>(null)

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount, setUnreadCount])

  useEffect(() => {
    if (
      pathname !== "/inbox" ||
      !latestNotification ||
      latestNotificationTs === null ||
      handledCreatedEventTsRef.current === latestNotificationTs
    ) {
      return
    }

    handledCreatedEventTsRef.current = latestNotificationTs
    setPages((previousPages) => ({
      all: previousPages.all
        ? {
            ...previousPages.all,
            items: prependNotificationItems(previousPages.all.items, latestNotification),
          }
        : previousPages.all,
      unread: previousPages.unread
        ? {
            ...previousPages.unread,
            items: prependNotificationItems(previousPages.unread.items, latestNotification),
          }
        : previousPages.unread,
    }))
    toast.success("New notification", {
      description: `${getActorDisplayName(latestNotification)} ${getNotificationActionLabel(latestNotification.type)}.`,
    })
  }, [latestNotification, latestNotificationTs, pathname])

  useEffect(() => {
    if (
      pathname !== "/inbox" ||
      !latestReadNotificationId ||
      !latestReadAt ||
      latestReadTs === null ||
      handledReadEventTsRef.current === latestReadTs
    ) {
      return
    }

    handledReadEventTsRef.current = latestReadTs
    setPages((previousPages) => markNotificationReadInPages(previousPages, latestReadNotificationId, latestReadAt))
  }, [latestReadAt, latestReadNotificationId, latestReadTs, pathname])

  const currentPage = pages[tab]

  const syncUrl = useCallback(
    (nextTab: InboxTab) => {
      if (typeof window === "undefined") {
        return
      }

      window.history.replaceState(null, "", createInboxHref(pathname, nextTab))
    },
    [pathname]
  )

  const fetchNotifications = useCallback(
    async ({
      nextTab,
      cursor,
      append,
    }: {
      nextTab: InboxTab
      cursor?: string | null
      append: boolean
    }) => {
      setError(null)

      if (append) {
        setIsLoadingMore(true)
      } else {
        setLoadingTab(nextTab)
      }

      try {
        const params = new URLSearchParams()
        params.set("tab", nextTab)

        if (cursor) {
          params.set("cursor", cursor)
        }

        const response = await fetch(`/api/inbox?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error ?? "Unable to load notifications.")
        }

        const data = (await response.json()) as NotificationsPagePayload

        setPages((previousPages) => {
          if (!append) {
            return {
              ...previousPages,
              [nextTab]: data,
            }
          }

          const previousPage = previousPages[nextTab]

          if (!previousPage) {
            return {
              ...previousPages,
              [nextTab]: data,
            }
          }

          const seenIds = new Set(previousPage.items.map((item) => item.id))
          const uniqueItems = data.items.filter((item) => !seenIds.has(item.id))

          return {
            ...previousPages,
            [nextTab]: {
              items: [...previousPage.items, ...uniqueItems],
              nextCursor: data.nextCursor,
            },
          }
        })
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Unable to load notifications."
        setError(message)
        toast.error(message)
      } finally {
        setLoadingTab(null)
        setIsLoadingMore(false)
      }
    },
    []
  )

  const handleTabChange = useCallback(
    (value: string) => {
      const nextTab = value === "unread" ? "unread" : "all"
      setTab(nextTab)
      setError(null)
      syncUrl(nextTab)

      if (!pages[nextTab]) {
        void fetchNotifications({
          nextTab,
          append: false,
        })
      }
    },
    [fetchNotifications, pages, syncUrl]
  )

  const handleLoadMore = useCallback(() => {
    if (!currentPage?.nextCursor || isLoadingMore) {
      return
    }

    void fetchNotifications({
      nextTab: tab,
      cursor: currentPage.nextCursor,
      append: true,
    })
  }, [currentPage?.nextCursor, fetchNotifications, isLoadingMore, tab])

  const markNotificationReadOptimistically = useCallback(
    (notificationId: string) => {
      const nextReadAt = new Date().toISOString()

      setPages((previousPages) => markNotificationReadInPages(previousPages, notificationId, nextReadAt))
    },
    []
  )

  const handleNotificationClick = useCallback(
    async (notification: InboxNotificationItem) => {
      if (pendingIds.includes(notification.id) || isMarkingAll) {
        return
      }

      const previousPages = pages
      const previousUnreadCount = unreadCount
      const wasUnread = !notification.readAt

      setPendingIds((previousIds) => [...previousIds, notification.id])

      if (wasUnread) {
        markNotificationReadOptimistically(notification.id)
        setUnreadCount((previousCount) => Math.max(0, previousCount - 1))
      }

      const result = await markNotificationReadAction({
        notificationId: notification.id,
      })

      setPendingIds((previousIds) => previousIds.filter((id) => id !== notification.id))

      if (!result.success) {
        setPages(previousPages)
        setUnreadCount(previousUnreadCount)
        toast.error(result.error)
        return
      }

      if (!notification.href) {
        toast.error("Content not available")
        router.refresh()
        return
      }

      router.push(notification.href)
    },
    [isMarkingAll, markNotificationReadOptimistically, pages, pendingIds, router, setUnreadCount, unreadCount]
  )

  const handleMarkAllRead = useCallback(async () => {
    if (isMarkingAll || unreadCount === 0) {
      return
    }

    const previousPages = pages
    const previousUnreadCount = unreadCount
    const nextReadAt = new Date().toISOString()

    setIsMarkingAll(true)
    setPages((previousPagesState) => ({
      all: previousPagesState.all
        ? {
            ...previousPagesState.all,
            items: previousPagesState.all.items.map((item) => (item.readAt ? item : { ...item, readAt: nextReadAt })),
          }
        : previousPagesState.all,
      unread: previousPagesState.unread
        ? {
            items: [],
            nextCursor: null,
          }
        : previousPagesState.unread,
    }))
    setUnreadCount(0)

    const result = await markAllNotificationsReadAction()

    setIsMarkingAll(false)

    if (!result.success) {
      setPages(previousPages)
      setUnreadCount(previousUnreadCount)
      toast.error(result.error)
      return
    }

    router.refresh()
  }, [isMarkingAll, pages, router, setUnreadCount, unreadCount])

  const unreadBadgeLabel = useMemo(() => formatUnreadCount(unreadCount), [unreadCount])

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/60">
        <div className="bg-linear-to-r from-primary/[0.08] via-primary/[0.03] to-transparent">
          <CardHeader className="gap-4 border-b border-border/60">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Inbox</Badge>
                  <Badge variant="secondary">{unreadBadgeLabel} unread</Badge>
                </div>
                <div>
                  <CardTitle className="text-2xl tracking-tight">Notifications</CardTitle>
                  <CardDescription>Track likes, comments, and follows across your videos and profile.</CardDescription>
                </div>
              </div>
              <Button type="button" variant="outline" disabled={isMarkingAll || unreadCount === 0} onClick={() => void handleMarkAllRead()}>
                {isMarkingAll ? <Loader2 className="size-4 animate-spin" /> : null}
                Mark all as read
              </Button>
            </div>
            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
        </div>
        <CardContent className="p-0">
          {error ? (
            <div className="border-b border-destructive/20 bg-destructive/5 px-6 py-4 text-sm">
              <p className="text-destructive">{error}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() =>
                  void fetchNotifications({
                    nextTab: tab,
                    append: false,
                  })
                }
              >
                Retry
              </Button>
            </div>
          ) : null}

          {loadingTab === tab || !currentPage ? (
            <InboxListSkeleton />
          ) : currentPage.items.length ? (
            <div className="divide-y divide-border/60">
              {currentPage.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  disabled={pendingIds.includes(notification.id) || isMarkingAll}
                  onClick={() => void handleNotificationClick(notification)}
                />
              ))}
            </div>
          ) : (
            <InboxEmptyState tab={tab} onShowAll={() => handleTabChange("all")} />
          )}
        </CardContent>
      </Card>

      {currentPage?.nextCursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={isLoadingMore || isMarkingAll} onClick={handleLoadMore}>
            {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : currentPage && currentPage.items.length ? (
        <p className="text-center text-xs text-muted-foreground">You&apos;re caught up.</p>
      ) : null}
    </div>
  )
}

function NotificationRow({
  notification,
  disabled,
  onClick,
}: {
  notification: InboxNotificationItem
  disabled: boolean
  onClick: () => void
}) {
  const Icon = notificationIcons[notification.type]
  const actorName = getActorDisplayName(notification)
  const actorHandle = getActorHandle(notification)
  const context = getNotificationContext(notification)
  const isUnread = !notification.readAt

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-start gap-4 px-6 py-4 text-left transition-colors outline-none",
        "hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isUnread && "bg-primary/[0.03]"
      )}
    >
      <Avatar className="ring-1 ring-border/70">
        <AvatarImage src={notification.actor.avatarUrl ?? undefined} alt={actorName} />
        <AvatarFallback>{actorName.charAt(0).toUpperCase()}</AvatarFallback>
        <AvatarBadge className={getNotificationIconClasses(notification.type)}>
          <Icon className="size-2" />
        </AvatarBadge>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm leading-6">
          <span className="font-semibold tracking-tight">{actorName}</span>{" "}
          <span className="text-muted-foreground">{actorHandle}</span>{" "}
          <span>{getNotificationActionLabel(notification.type)}</span>
        </p>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {notification.type === "COMMENT" && notification.commentPreview ? `“${context}”` : context}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 pl-2">
        <p className="text-xs text-muted-foreground">{notification.createdAtRelative}</p>
        <span
          className={cn(
            "size-2.5 rounded-full bg-primary transition-opacity",
            isUnread ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={!isUnread}
        />
      </div>
    </button>
  )
}

function InboxEmptyState({
  tab,
  onShowAll,
}: {
  tab: InboxTab
  onShowAll: () => void
}) {
  return (
    <Empty className="rounded-none border-0 bg-transparent py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox className="size-5" />
        </EmptyMedia>
        <EmptyTitle>{tab === "unread" ? "No unread notifications" : "Your inbox is quiet"}</EmptyTitle>
        <EmptyDescription>
          {tab === "unread"
            ? "Everything has been read. New activity will show up here automatically."
            : "Likes, comments, and follows will appear here once people start interacting with your content."}
        </EmptyDescription>
      </EmptyHeader>
      {tab === "unread" ? (
        <EmptyContent>
          <Button type="button" variant="outline" onClick={onShowAll}>
            View all notifications
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

function InboxListSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-start gap-4 px-6 py-4">
          <Skeleton className="size-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-9/12" />
            <Skeleton className="h-4 w-7/12" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="ml-auto size-2.5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
