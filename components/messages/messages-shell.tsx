"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { MessageCircleMore, Radio, SearchSlash } from "lucide-react"
import { useEffect } from "react"

import { useChat } from "@/components/realtime/chat-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { InboxConversationItem } from "@/lib/chat/types"
import { cn } from "@/lib/utils"

function getDisplayName(conversation: InboxConversationItem) {
  return conversation.otherUser.name ?? conversation.otherUser.username ?? "Creator"
}

function getHandle(conversation: InboxConversationItem) {
  return `@${conversation.otherUser.username ?? conversation.otherUser.id.slice(0, 8)}`
}

function formatUnreadCount(count: number) {
  if (count <= 0) {
    return null
  }

  return count > 99 ? "99+" : String(count)
}

function getConversationPreview(conversation: InboxConversationItem) {
  if (!conversation.lastMessage) {
    return "Start the conversation"
  }

  if (conversation.lastMessage.kind === "VIDEO_SHARE") {
    return conversation.lastMessage.content?.trim() ? `Shared a video: ${conversation.lastMessage.content}` : "Shared a video"
  }

  return conversation.lastMessage.content ?? "Start the conversation"
}

export function MessagesShell({
  initialConversations,
  children,
}: {
  initialConversations: InboxConversationItem[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { connectionState, hydrateInbox, inboxConversations } = useChat()

  useEffect(() => {
    hydrateInbox(initialConversations)
  }, [hydrateInbox, initialConversations])

  const conversations = Object.values(inboxConversations).sort((left, right) => {
    const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0
    const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0

    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }

    return left.id.localeCompare(right.id)
  })

  const isConversationRoute = pathname.startsWith("/messages/")

  return (
    <div className="grid min-h-[calc(100vh-8.5rem)] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card
        className={cn(
          "overflow-hidden border-border/70 bg-white/95 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]",
          isConversationRoute ? "hidden lg:flex lg:flex-col" : "flex flex-col"
        )}
      >
        <div className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(13,148,136,0.12),rgba(255,255,255,0.95)_55%)] px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white/70">
                  Direct messages
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Radio className={cn("size-3", connectionState === "open" ? "text-emerald-500" : "text-amber-500")} />
                  {connectionState}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
                <p className="text-sm text-muted-foreground">Real-time conversations with creators and viewers.</p>
              </div>
            </div>
            <div className="grid size-11 place-items-center rounded-2xl bg-[#0f766e] text-white shadow-sm">
              <MessageCircleMore className="size-5" />
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {conversations.length ? (
            <div className="divide-y divide-border/60">
              {conversations.map((conversation) => {
                const isActive = pathname === `/messages/${conversation.id}`
                const unreadLabel = formatUnreadCount(conversation.unreadCount)
                const displayName = getDisplayName(conversation)

                return (
                  <Link
                    key={conversation.id}
                    href={`/messages/${conversation.id}`}
                    className={cn(
                      "group flex items-center gap-3 px-5 py-4 transition-colors",
                      "hover:bg-accent/40",
                      isActive && "bg-[#0f766e]/8"
                    )}
                  >
                    <Avatar size="lg" className="ring-1 ring-border/70">
                      <AvatarImage
                        src={conversation.otherUser.avatarUrl ?? conversation.otherUser.image ?? undefined}
                        alt={displayName}
                      />
                      <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tracking-tight">{displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">{getHandle(conversation)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] text-muted-foreground">
                            {conversation.lastMessageAt
                              ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })
                              : "New"}
                          </p>
                          {unreadLabel ? (
                            <span className="mt-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#0f766e] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {unreadLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {getConversationPreview(conversation)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <Empty className="border-0 bg-transparent py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchSlash className="size-5" />
                </EmptyMedia>
                <EmptyTitle>No conversations yet</EmptyTitle>
                <EmptyDescription>Open a creator profile and use the Message button to start a DM.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </ScrollArea>
      </Card>

      <div className={cn(isConversationRoute ? "flex" : "hidden lg:flex", "min-h-0 flex-col")}>{children}</div>
    </div>
  )
}
