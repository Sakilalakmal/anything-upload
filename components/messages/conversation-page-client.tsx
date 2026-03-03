"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, CheckCheck, Eye, Flame, Heart, Laugh, Loader2, SendHorizonal, Share2, ThumbsUp } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react"
import { toast } from "sonner"

import { markConversationReadAction, sendMessageAction, toggleReactionAction } from "@/app/actions/chat"
import { MessageReactionPicker } from "@/components/messages/message-reaction-picker"
import { ShareVideoDialog, type ShareableVideoItem } from "@/components/messages/share-video-dialog"
import { VideoShareMessageCard } from "@/components/messages/video-share-message-card"
import { useChat } from "@/components/realtime/chat-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { ChatConversation, ChatMessage, MessagesPagePayload } from "@/lib/chat/types"
import { CHAT_REACTION_EMOJIS, parseVideoIdFromUrl } from "@/lib/chat/validations"
import { cn } from "@/lib/utils"

type UIMessage = ChatMessage & {
  clientMessageId?: string | null
  status?: "sending" | "failed"
}

const REACTION_ICON_BY_EMOJI: Record<(typeof CHAT_REACTION_EMOJIS)[number], ComponentType<{ className?: string }>> = {
  "❤️": Heart,
  "😂": Laugh,
  "🔥": Flame,
  "👍": ThumbsUp,
  "👀": Eye,
}

function getDisplayName(conversation: ChatConversation) {
  return conversation.otherUser.name ?? conversation.otherUser.username ?? "Creator"
}

function mergeMessages(current: UIMessage[], incoming: UIMessage[]) {
  const nextByKey = new Map<string, UIMessage>()

  for (const message of current) {
    nextByKey.set(message.clientMessageId ?? message.id, message)
  }

  for (const message of incoming) {
    nextByKey.set(message.clientMessageId ?? message.id, {
      ...nextByKey.get(message.clientMessageId ?? message.id),
      ...message,
      status: undefined,
    })
  }

  return [...nextByKey.values()].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime()
    const rightTime = new Date(right.createdAt).getTime()

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    return left.id.localeCompare(right.id)
  })
}

function createClientMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getPresenceLabel(lastSeenAt: string | null, isOnline: boolean) {
  if (isOnline) {
    return "Online"
  }

  if (!lastSeenAt) {
    return "Offline"
  }

  return `Last seen ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`
}

export function ConversationPageClient({
  currentUserId,
  conversation,
  initialMessages,
  initialNextCursor,
}: {
  currentUserId: string
  conversation: ChatConversation
  initialMessages: ChatMessage[]
  initialNextCursor: string | null
}) {
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const ackTimeoutsRef = useRef<Record<string, number>>({})
  const {
    connectionState,
    messagesByConversation,
    typingByConversation,
    presenceByUser,
    seenReceiptsByConversation,
    sendMessage,
    sendTyping,
    markConversationRead,
    toggleReaction,
  } = useChat()

  const [messages, setMessages] = useState<UIMessage[]>(initialMessages)
  const [composerValue, setComposerValue] = useState("")
  const [isFallbackSending, setIsFallbackSending] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [currentUserLastReadAt, setCurrentUserLastReadAt] = useState(conversation.currentUserLastReadAt)
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState(conversation.otherUserLastReadAt)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [shareNote, setShareNote] = useState("")
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [manualVideoUrl, setManualVideoUrl] = useState("")
  const [shareableVideos, setShareableVideos] = useState<ShareableVideoItem[]>([])

  const realtimeMessages = useMemo(() => messagesByConversation[conversation.id] ?? [], [conversation.id, messagesByConversation])
  const typingUsers = typingByConversation[conversation.id] ?? {}
  const latestSeenReceipt = seenReceiptsByConversation[conversation.id]
  const otherPresence = presenceByUser[conversation.otherUser.id]

  useEffect(() => {
    setMessages((current) => mergeMessages(current, realtimeMessages))
  }, [realtimeMessages])

  useEffect(() => {
    if (!latestSeenReceipt) {
      return
    }

    if (latestSeenReceipt.userId === currentUserId) {
      setCurrentUserLastReadAt(latestSeenReceipt.lastReadAt)
    } else {
      setOtherUserLastReadAt(latestSeenReceipt.lastReadAt)
    }
  }, [currentUserId, latestSeenReceipt])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    })
  }, [messages.length])

  const latestIncomingMessage = useMemo(
    () => [...messages].reverse().find((message) => message.senderId !== currentUserId) ?? null,
    [currentUserId, messages]
  )

  useEffect(() => {
    if (!latestIncomingMessage) {
      return
    }

    const latestIncomingAt = new Date(latestIncomingMessage.createdAt).getTime()
    const readAt = currentUserLastReadAt ? new Date(currentUserLastReadAt).getTime() : 0

    if (latestIncomingAt <= readAt) {
      return
    }

    const timer = window.setTimeout(async () => {
      const sentOverSocket = markConversationRead({
        conversationId: conversation.id,
        messageId: latestIncomingMessage.id,
      })

      if (sentOverSocket) {
        return
      }

      const result = await markConversationReadAction({
        conversationId: conversation.id,
        messageId: latestIncomingMessage.id,
      })

      if (result.success) {
        setCurrentUserLastReadAt(result.lastReadAt)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [conversation.id, currentUserLastReadAt, latestIncomingMessage, markConversationRead])

  useEffect(() => {
    const ackTimeouts = ackTimeoutsRef.current

    return () => {
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current)
      }

      for (const timeoutId of Object.values(ackTimeouts)) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    for (const message of realtimeMessages) {
      if (!message.clientMessageId || !ackTimeoutsRef.current[message.clientMessageId]) {
        continue
      }

      window.clearTimeout(ackTimeoutsRef.current[message.clientMessageId])
      delete ackTimeoutsRef.current[message.clientMessageId]
    }
  }, [realtimeMessages])

  const typingUserIds = Object.keys(typingUsers).filter((userId) => userId !== currentUserId)
  const displayName = getDisplayName(conversation)
  const lastOwnMessageId = useMemo(
    () => [...messages].reverse().find((message) => message.senderId === currentUserId)?.id ?? null,
    [currentUserId, messages]
  )

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)

    try {
      const response = await fetch(`/api/chat/conversations/${conversation.id}/messages?cursor=${encodeURIComponent(nextCursor)}`, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Unable to load older messages.")
      }

      const page = (await response.json()) as MessagesPagePayload
      setNextCursor(page.nextCursor)
      setMessages((current) => mergeMessages(page.items, current))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load older messages.")
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleTypingPulse = () => {
    const didSend = sendTyping(conversation.id, true)

    if (!didSend) {
      return
    }

    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
    }

    typingTimerRef.current = window.setTimeout(() => {
      sendTyping(conversation.id, false)
      typingTimerRef.current = null
    }, 1_500)
  }

  const resolvePendingMessage = (clientMessageId: string, message: ChatMessage) => {
    if (ackTimeoutsRef.current[clientMessageId]) {
      window.clearTimeout(ackTimeoutsRef.current[clientMessageId])
      delete ackTimeoutsRef.current[clientMessageId]
    }

    setMessages((current) =>
      mergeMessages(
        current.filter((item) => item.clientMessageId !== clientMessageId),
        [{ ...message, clientMessageId }]
      )
    )
  }

  const queueMessageAckTimeout = (clientMessageId: string) => {
    ackTimeoutsRef.current[clientMessageId] = window.setTimeout(() => {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === clientMessageId ? { ...message, status: "failed" } : message
        )
      )
      delete ackTimeoutsRef.current[clientMessageId]
      toast.error("Live send confirmation timed out.")
    }, 8_000)
  }

  const sendOptimisticMessage = async (optimisticMessage: UIMessage, input: Parameters<typeof sendMessage>[0]) => {
    setMessages((current) => mergeMessages(current, [optimisticMessage]))

    const sentOverSocket = sendMessage(input)

    if (sentOverSocket) {
      queueMessageAckTimeout(optimisticMessage.clientMessageId!)
      return true
    }

    setIsFallbackSending(true)

    const result = await sendMessageAction({
      conversationId: conversation.id,
      kind: input.kind,
      content: input.content,
      videoId: input.videoId,
    })

    setIsFallbackSending(false)

    if (!result.success) {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === optimisticMessage.clientMessageId ? { ...message, status: "failed" } : message
        )
      )
      toast.error(result.error)
      return false
    }

    resolvePendingMessage(optimisticMessage.clientMessageId!, result.message)
    router.refresh()
    return true
  }

  const handleSubmitText = async () => {
    const content = composerValue.trim()

    if (!content) {
      return
    }

    const clientMessageId = createClientMessageId()
    setComposerValue("")

    await sendOptimisticMessage(
      {
        id: `temp:${clientMessageId}`,
        conversationId: conversation.id,
        senderId: currentUserId,
        kind: "TEXT",
        content,
        videoId: null,
        video: null,
        reactions: [],
        createdAt: new Date().toISOString(),
        clientMessageId,
        status: "sending",
      },
      {
        conversationId: conversation.id,
        kind: "TEXT",
        content,
        clientMessageId,
      }
    )
  }

  const handleShareSubmit = async () => {
    const parsedManualVideoId = manualVideoUrl ? parseVideoIdFromUrl(manualVideoUrl) : null
    const videoId = selectedVideoId ?? parsedManualVideoId

    if (!videoId) {
      toast.error("Choose a video to share.")
      return
    }

    const preview = shareableVideos.find((video) => video.id === videoId) ?? null
    const clientMessageId = createClientMessageId()

    const success = await sendOptimisticMessage(
      {
        id: `temp:${clientMessageId}`,
        conversationId: conversation.id,
        senderId: currentUserId,
        kind: "VIDEO_SHARE",
        content: shareNote.trim() || null,
        videoId,
        video: preview
          ? {
              id: preview.id,
              title: preview.title,
              thumbnailUrl: preview.thumbnailUrl,
              createdAt: preview.createdAt,
              creator: preview.creator,
            }
          : null,
        reactions: [],
        createdAt: new Date().toISOString(),
        clientMessageId,
        status: "sending",
      },
      {
        conversationId: conversation.id,
        kind: "VIDEO_SHARE",
        content: shareNote.trim() || null,
        videoId,
        clientMessageId,
      }
    )

    if (success) {
      setIsShareDialogOpen(false)
      setShareNote("")
      setSelectedVideoId(null)
      setManualVideoUrl("")
    }
  }

  const handleReactionToggle = async (messageId: string, emoji: (typeof CHAT_REACTION_EMOJIS)[number]) => {
    const sentOverSocket = toggleReaction({ messageId, emoji })

    if (sentOverSocket) {
      return
    }

    const result = await toggleReactionAction({ messageId, emoji })

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, reactions: result.reactionsSummary } : message
      )
    )
  }

  const seenMessageId = useMemo(() => {
    if (!otherUserLastReadAt) {
      return null
    }

    const readAt = new Date(otherUserLastReadAt).getTime()

    return [...messages]
      .reverse()
      .find((message) => message.senderId === currentUserId && new Date(message.createdAt).getTime() <= readAt)?.id ?? null
  }, [currentUserId, messages, otherUserLastReadAt])

  const presenceLabel = getPresenceLabel(
    otherPresence?.lastSeenAt ?? conversation.otherUser.lastSeenAt ?? null,
    otherPresence?.isOnline ?? false
  )

  return (
    <>
      <Card className="flex min-h-[calc(100vh-8.5rem)] flex-col overflow-hidden border-border/70 bg-white/95 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
        <div className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(15,118,110,0.14),rgba(255,255,255,0.98)_58%)] px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="lg:hidden">
              <Link href="/messages" aria-label="Back to messages">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="relative">
              <Avatar size="lg" className="ring-1 ring-border/70">
                <AvatarImage src={conversation.otherUser.avatarUrl ?? conversation.otherUser.image ?? undefined} alt={displayName} />
                <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute right-0 bottom-0 size-3 rounded-full border-2 border-white",
                  otherPresence?.isOnline ? "bg-emerald-500" : "bg-slate-300"
                )}
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight">{displayName}</h2>
              <p className="truncate text-sm text-muted-foreground">
                @{conversation.otherUser.username ?? conversation.otherUser.id.slice(0, 8)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{typingUserIds.length ? `${displayName} is typing...` : presenceLabel}</p>
            </div>
            <div className="ml-auto hidden text-right text-xs text-muted-foreground sm:block">
              <p className={cn("font-medium", connectionState === "open" ? "text-emerald-600" : "text-amber-600")}>
                {connectionState === "open" ? "Realtime connected" : "Fallback mode"}
              </p>
              <p>{otherPresence?.isOnline ? "Seen updates live" : "Last seen sync enabled"}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.08),_transparent_30%),linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,1))]">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
            {nextCursor ? (
              <div className="flex justify-center">
                <Button type="button" variant="outline" size="sm" disabled={isLoadingMore} onClick={() => void handleLoadMore()}>
                  {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                  Load older messages
                </Button>
              </div>
            ) : null}

            {messages.length ? (
              messages.map((message) => {
                const isOwnMessage = message.senderId === currentUserId
                const isSeen = seenMessageId === message.id
                const isLatestOwnMessage = lastOwnMessageId === message.id
                const statusLabel =
                  message.status === "sending"
                    ? "Sending..."
                    : message.status === "failed"
                      ? "Failed"
                      : isOwnMessage && isLatestOwnMessage
                        ? isSeen
                          ? "Seen"
                          : "Sent"
                        : null

                return (
                  <div key={message.clientMessageId ?? message.id} className={cn("group flex", isOwnMessage ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[88%] space-y-2 sm:max-w-[70%]", isOwnMessage ? "items-end text-right" : "items-start")}>
                      <div className={cn("flex items-center gap-2", isOwnMessage ? "justify-end" : "justify-start")}>
                        {!isOwnMessage ? (
                          <MessageReactionPicker align="start" onSelect={(emoji) => void handleReactionToggle(message.id, emoji)} />
                        ) : null}
                        <div
                          className={cn(
                            "space-y-3 rounded-[1.7rem] px-4 py-3 shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5",
                            isOwnMessage ? "rounded-br-md bg-[#0f766e] text-white" : "rounded-bl-md border border-border/60 bg-white text-foreground"
                          )}
                        >
                          {message.content ? <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p> : null}
                          {message.kind === "VIDEO_SHARE" && message.videoId ? (
                            <VideoShareMessageCard videoId={message.videoId} video={message.video} isOwnMessage={isOwnMessage} />
                          ) : null}
                        </div>
                        {isOwnMessage ? (
                          <MessageReactionPicker align="end" onSelect={(emoji) => void handleReactionToggle(message.id, emoji)} />
                        ) : null}
                      </div>

                      {message.reactions.length ? (
                        <div className={cn("flex flex-wrap gap-2", isOwnMessage ? "justify-end" : "justify-start")}>
                          {message.reactions.map((reaction) => {
                            const Icon = REACTION_ICON_BY_EMOJI[reaction.emoji as (typeof CHAT_REACTION_EMOJIS)[number]]
                            const reactedByMe = reaction.userIds.includes(currentUserId)

                            return (
                              <button
                                key={reaction.emoji}
                                type="button"
                                onClick={() => void handleReactionToggle(message.id, reaction.emoji as (typeof CHAT_REACTION_EMOJIS)[number])}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                                  reactedByMe ? "border-[#0f766e]/25 bg-[#0f766e]/10 text-[#0f766e]" : "border-border/60 bg-white text-muted-foreground"
                                )}
                              >
                                <Icon className="size-3.5" />
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground", isOwnMessage ? "justify-end" : "justify-start")}>
                        <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
                        {statusLabel ? (
                          <span className={cn("inline-flex items-center gap-1", statusLabel === "Seen" && "text-[#0f766e]")}>
                            {statusLabel === "Seen" ? <CheckCheck className="size-3.5" /> : null}
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <Empty className="border bg-white/70 py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SendHorizonal className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No messages yet</EmptyTitle>
                  <EmptyDescription>Say hello or share a video to start this conversation.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {typingUserIds.length ? <p className="text-sm text-muted-foreground">{displayName} is typing...</p> : null}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 bg-white/90 px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12 shrink-0 rounded-full border-border/70"
              onClick={() => setIsShareDialogOpen(true)}
              aria-label="Share video"
            >
              <Share2 className="size-4" />
            </Button>
            <Textarea
              value={composerValue}
              onChange={(event) => {
                setComposerValue(event.target.value)
                handleTypingPulse()
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void handleSubmitText()
                }
              }}
              placeholder="Write a message"
              rows={1}
              maxLength={1000}
              className="min-h-12 resize-none rounded-3xl border-border/70 bg-white shadow-none focus-visible:ring-[#0f766e]/30"
            />
            <Button
              type="button"
              className="h-12 rounded-full bg-[#0f766e] px-5 text-white hover:bg-[#0b5f58]"
              onClick={() => void handleSubmitText()}
              disabled={!composerValue.trim() || isFallbackSending}
            >
              {isFallbackSending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
              Send
            </Button>
          </div>
        </div>
      </Card>

      <ShareVideoDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        note={shareNote}
        onNoteChange={setShareNote}
        selectedVideoId={selectedVideoId}
        onSelectVideoId={setSelectedVideoId}
        manualUrl={manualVideoUrl}
        onManualUrlChange={setManualVideoUrl}
        isSubmitting={isFallbackSending}
        onSubmit={() => void handleShareSubmit()}
        onVideosLoaded={setShareableVideos}
      />
    </>
  )
}

export function ConversationPageSkeleton() {
  return (
    <Card className="flex min-h-[calc(100vh-8.5rem)] flex-col overflow-hidden border-border/70">
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 px-5 py-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className={cn("flex", index % 2 === 0 ? "justify-start" : "justify-end")}>
            <Skeleton className="h-16 w-52 rounded-3xl" />
          </div>
        ))}
      </div>
      <div className="border-t px-5 py-4">
        <div className="flex items-end gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-12 flex-1 rounded-3xl" />
          <Skeleton className="h-12 w-20 rounded-full" />
        </div>
      </div>
    </Card>
  )
}
