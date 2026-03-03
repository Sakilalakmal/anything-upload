"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, Loader2, SendHorizonal } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { markConversationReadAction, sendMessageAction } from "@/app/actions/chat"
import { useChat } from "@/components/realtime/chat-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { ChatConversation, ChatMessage, MessagesPagePayload } from "@/lib/chat/types"
import { cn } from "@/lib/utils"

type UIMessage = ChatMessage & {
  clientMessageId?: string | null
  status?: "sending" | "failed"
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
  const { connectionState, messagesByConversation, typingByConversation, readReceiptsByConversation, sendMessage, sendTyping, markConversationRead } =
    useChat()

  const [messages, setMessages] = useState<UIMessage[]>(initialMessages)
  const [composerValue, setComposerValue] = useState("")
  const [isFallbackSending, setIsFallbackSending] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [currentUserLastReadAt, setCurrentUserLastReadAt] = useState(conversation.currentUserLastReadAt)
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState(conversation.otherUserLastReadAt)

  const realtimeMessages = useMemo(() => messagesByConversation[conversation.id] ?? [], [conversation.id, messagesByConversation])
  const typingUsers = typingByConversation[conversation.id] ?? {}
  const latestReadReceipt = readReceiptsByConversation[conversation.id]

  useEffect(() => {
    setMessages((current) => mergeMessages(current, realtimeMessages))
  }, [realtimeMessages])

  useEffect(() => {
    if (!latestReadReceipt) {
      return
    }

    if (latestReadReceipt.userId === currentUserId) {
      setCurrentUserLastReadAt(latestReadReceipt.lastReadAt)
    } else {
      setOtherUserLastReadAt(latestReadReceipt.lastReadAt)
    }
  }, [currentUserId, latestReadReceipt])

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
        [
          {
            ...message,
            clientMessageId,
          },
        ]
      )
    )
  }

  const handleSubmit = async () => {
    const content = composerValue.trim()

    if (!content) {
      return
    }

    const clientMessageId = createClientMessageId()
    const optimisticMessage: UIMessage = {
      id: `temp:${clientMessageId}`,
      conversationId: conversation.id,
      senderId: currentUserId,
      content,
      createdAt: new Date().toISOString(),
      clientMessageId,
      status: "sending",
    }

    setComposerValue("")
    setMessages((current) => mergeMessages(current, [optimisticMessage]))

    const sentOverSocket = sendMessage({
      conversationId: conversation.id,
      content,
      clientMessageId,
    })

    if (sentOverSocket) {
      ackTimeoutsRef.current[clientMessageId] = window.setTimeout(() => {
        setMessages((current) =>
          current.map((message) =>
            message.clientMessageId === clientMessageId ? { ...message, status: "failed" } : message
          )
        )
        delete ackTimeoutsRef.current[clientMessageId]
        toast.error("Live send confirmation timed out.")
      }, 8_000)

      return
    }

    setIsFallbackSending(true)

    const result = await sendMessageAction({
      conversationId: conversation.id,
      content,
    })

    setIsFallbackSending(false)

    if (!result.success) {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === clientMessageId ? { ...message, status: "failed" } : message
        )
      )
      toast.error(result.error)
      return
    }

    resolvePendingMessage(clientMessageId, result.message)
    router.refresh()
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

  return (
    <Card className="flex min-h-[calc(100vh-8.5rem)] flex-col overflow-hidden border-border/70 bg-white/95 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(15,118,110,0.14),rgba(255,255,255,0.96)_55%)] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="lg:hidden">
            <Link href="/messages" aria-label="Back to messages">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Avatar size="lg" className="ring-1 ring-border/70">
            <AvatarImage src={conversation.otherUser.avatarUrl ?? conversation.otherUser.image ?? undefined} alt={displayName} />
            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">{displayName}</h2>
            <p className="truncate text-sm text-muted-foreground">
              @{conversation.otherUser.username ?? conversation.otherUser.id.slice(0, 8)}
            </p>
          </div>
          <div className="ml-auto hidden text-right text-xs text-muted-foreground sm:block">
            <p>{connectionState === "open" ? "Live" : "Fallback mode"}</p>
            <p>{typingUserIds.length ? "Typing..." : "Realtime DM thread"}</p>
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

              return (
                <div key={message.clientMessageId ?? message.id} className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] space-y-1 sm:max-w-[70%]", isOwnMessage ? "items-end text-right" : "items-start")}>
                    <div
                      className={cn(
                        "rounded-3xl px-4 py-3 text-sm shadow-sm transition-transform duration-200 hover:-translate-y-0.5",
                        isOwnMessage
                          ? "rounded-br-md bg-[#0f766e] text-white"
                          : "rounded-bl-md border border-border/60 bg-white text-foreground"
                      )}
                    >
                      {message.content}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
                      {message.status === "sending" ? <span>Sending...</span> : null}
                      {message.status === "failed" ? <span className="text-destructive">Failed</span> : null}
                      {isOwnMessage && isSeen ? <span className="text-[#0f766e]">Seen</span> : null}
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
                <EmptyDescription>Say hello to start this conversation.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {typingUserIds.length ? <p className="text-sm text-muted-foreground">{displayName} is typing...</p> : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 bg-white/90 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-3">
          <Textarea
            value={composerValue}
            onChange={(event) => {
              setComposerValue(event.target.value)
              handleTypingPulse()
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void handleSubmit()
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
            onClick={() => void handleSubmit()}
            disabled={!composerValue.trim() || isFallbackSending}
          >
            {isFallbackSending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
            Send
          </Button>
        </div>
      </div>
    </Card>
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
          <Skeleton className="h-12 flex-1 rounded-3xl" />
          <Skeleton className="h-12 w-20 rounded-full" />
        </div>
      </div>
    </Card>
  )
}
