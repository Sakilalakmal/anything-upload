"use client"

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import { chatServerEventSchema } from "@/lib/chat/events"
import type { ChatMessage, InboxConversationItem, PresenceState } from "@/lib/chat/types"

const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const PRESENCE_HEARTBEAT_MS = 45_000

type ConnectionState = "idle" | "connecting" | "open" | "reconnecting" | "closed"

type RealtimeMessage = ChatMessage & {
  clientMessageId?: string | null
}

type SeenReceiptEvent = {
  userId: string
  lastReadAt: string | null
  messageId: string | null
}

type ChatContextValue = {
  connectionState: ConnectionState
  totalUnreadCount: number
  inboxConversations: Record<string, InboxConversationItem>
  messagesByConversation: Record<string, RealtimeMessage[]>
  typingByConversation: Record<string, Record<string, boolean>>
  presenceByUser: Record<string, PresenceState>
  seenReceiptsByConversation: Record<string, SeenReceiptEvent>
  hydrateInbox: (conversations: InboxConversationItem[]) => void
  sendMessage: (input: {
    conversationId?: string
    recipientId?: string
    kind?: "TEXT" | "VIDEO_SHARE"
    content?: string | null
    videoId?: string
    clientMessageId?: string
  }) => boolean
  sendTyping: (conversationId: string, isTyping: boolean) => boolean
  markConversationRead: (input: { conversationId: string; messageId?: string }) => boolean
  toggleReaction: (input: { messageId: string; emoji: string }) => boolean
}

const ChatContext = createContext<ChatContextValue | null>(null)

function mergeInboxConversation(
  current: InboxConversationItem | undefined,
  incoming: InboxConversationItem
): InboxConversationItem {
  if (!current) {
    return incoming
  }

  const currentTime = current.lastMessageAt ? new Date(current.lastMessageAt).getTime() : 0
  const incomingTime = incoming.lastMessageAt ? new Date(incoming.lastMessageAt).getTime() : 0
  const shouldUseIncomingMessage = incomingTime >= currentTime

  return {
    ...current,
    ...incoming,
    lastMessageAt: shouldUseIncomingMessage ? incoming.lastMessageAt : current.lastMessageAt,
    lastMessage: shouldUseIncomingMessage ? incoming.lastMessage : current.lastMessage,
    unreadCount: incoming.unreadCount,
    currentUserLastReadAt: incoming.currentUserLastReadAt ?? current.currentUserLastReadAt,
    otherUserLastReadAt: incoming.otherUserLastReadAt ?? current.otherUserLastReadAt,
    otherUser: {
      ...current.otherUser,
      ...incoming.otherUser,
    },
  }
}

function appendRealtimeMessage(current: RealtimeMessage[], incoming: RealtimeMessage) {
  const nextMessages = current.filter(
    (message) =>
      message.id !== incoming.id &&
      (!incoming.clientMessageId || message.clientMessageId !== incoming.clientMessageId)
  )

  nextMessages.push(incoming)
  nextMessages.sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime()
    const rightTime = new Date(right.createdAt).getTime()

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    return left.id.localeCompare(right.id)
  })

  return nextMessages
}

export function ChatProvider({
  sessionUserId,
  initialUnreadCount,
  children,
}: {
  sessionUserId: string | null
  initialUnreadCount: number
  children: ReactNode
}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [totalUnreadCount, setTotalUnreadCount] = useState(initialUnreadCount)
  const [inboxConversations, setInboxConversations] = useState<Record<string, InboxConversationItem>>({})
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, RealtimeMessage[]>>({})
  const [typingByConversation, setTypingByConversation] = useState<Record<string, Record<string, boolean>>>({})
  const [presenceByUser, setPresenceByUser] = useState<Record<string, PresenceState>>({})
  const [seenReceiptsByConversation, setSeenReceiptsByConversation] = useState<Record<string, SeenReceiptEvent>>({})
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    setTotalUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  useEffect(() => {
    setInboxConversations({})
    setMessagesByConversation({})
    setTypingByConversation({})
    setPresenceByUser({})
    setSeenReceiptsByConversation({})
  }, [sessionUserId])

  const handleServerEvent = useEffectEvent((rawData: string) => {
    let payload: unknown

    try {
      payload = JSON.parse(rawData)
    } catch {
      return
    }

    const parsed = chatServerEventSchema.safeParse(payload)

    if (!parsed.success) {
      return
    }

    const event = parsed.data

    switch (event.type) {
      case "message:new": {
        const data = event.data

        setMessagesByConversation((current) => ({
          ...current,
          [data.conversationId]: appendRealtimeMessage(current[data.conversationId] ?? [], {
            ...data.message,
            clientMessageId: data.clientMessageId ?? null,
          }),
        }))
        setInboxConversations((current) => {
          const existingConversation = current[data.conversationId]

          if (!existingConversation) {
            return current
          }

          return {
            ...current,
            [data.conversationId]: {
              ...existingConversation,
              lastMessageAt: data.message.createdAt,
              lastMessage: {
                id: data.message.id,
                conversationId: data.message.conversationId,
                senderId: data.message.senderId,
                kind: data.message.kind,
                content: data.message.content,
                videoId: data.message.videoId,
                createdAt: data.message.createdAt,
              },
            },
          }
        })
        return
      }
      case "typing": {
        const data = event.data

        setTypingByConversation((current) => {
          const currentConversationTyping = current[data.conversationId] ?? {}
          const nextConversationTyping = {
            ...currentConversationTyping,
          }

          if (data.isTyping) {
            nextConversationTyping[data.userId] = true
          } else {
            delete nextConversationTyping[data.userId]
          }

          return {
            ...current,
            [data.conversationId]: nextConversationTyping,
          }
        })
        return
      }
      case "message:seen": {
        const data = event.data

        setSeenReceiptsByConversation((current) => ({
          ...current,
          [data.conversationId]: data,
        }))
        setInboxConversations((current) => {
          const existingConversation = current[data.conversationId]

          if (!existingConversation) {
            return current
          }

          return {
            ...current,
            [data.conversationId]:
              data.userId === sessionUserId
                ? {
                    ...existingConversation,
                    currentUserLastReadAt: data.lastReadAt,
                  }
                : {
                    ...existingConversation,
                    otherUserLastReadAt: data.lastReadAt,
                  },
          }
        })
        return
      }
      case "reaction:update": {
        const data = event.data

        setMessagesByConversation((current) => {
          const nextState = { ...current }

          for (const [conversationId, messages] of Object.entries(current)) {
            const targetIndex = messages.findIndex((message) => message.id === data.messageId)

            if (targetIndex === -1) {
              continue
            }

            const nextMessages = [...messages]
            nextMessages[targetIndex] = {
              ...nextMessages[targetIndex],
              reactions: data.reactionsSummary,
            }
            nextState[conversationId] = nextMessages
          }

          return nextState
        })
        return
      }
      case "presence:update": {
        const data = event.data

        setPresenceByUser((current) => ({
          ...current,
          [data.userId]: data,
        }))
        setInboxConversations((current) => {
          let didChange = false
          const nextState: Record<string, InboxConversationItem> = {}

          for (const [conversationId, conversation] of Object.entries(current)) {
            if (conversation.otherUser.id !== data.userId) {
              nextState[conversationId] = conversation
              continue
            }

            didChange = true
            nextState[conversationId] = {
              ...conversation,
              otherUser: {
                ...conversation.otherUser,
                lastSeenAt: data.lastSeenAt,
              },
            }
          }

          return didChange ? nextState : current
        })
        return
      }
      case "inbox:update": {
        const data = event.data

        setInboxConversations((current) => ({
          ...current,
          [data.conversation.id]: mergeInboxConversation(current[data.conversation.id], data.conversation),
        }))
        setPresenceByUser((current) => ({
          ...current,
          [data.conversation.otherUser.id]: current[data.conversation.otherUser.id] ?? {
            userId: data.conversation.otherUser.id,
            isOnline: false,
            lastSeenAt: data.conversation.otherUser.lastSeenAt ?? null,
          },
        }))
        setTotalUnreadCount(data.totalUnreadCount)
        return
      }
      case "error":
        toast.error(event.data.message)
        return
    }
  })

  useEffect(() => {
    if (!sessionUserId || typeof window === "undefined") {
      setConnectionState("closed")
      return
    }

    let reconnectTimer: number | null = null
    let heartbeatTimer: number | null = null
    let reconnectAttempt = 0
    let disposed = false

    const clearHeartbeat = () => {
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }

    const closeSocket = () => {
      clearHeartbeat()

      if (!socketRef.current) {
        return
      }

      socketRef.current.close()
      socketRef.current = null
    }

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== null) {
        return
      }

      const delay =
        Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt) +
        Math.floor(Math.random() * 250)

      reconnectAttempt += 1
      setConnectionState("reconnecting")

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        void connect()
      }, delay)
    }

    const connect = async () => {
      setConnectionState(reconnectAttempt > 0 ? "reconnecting" : "connecting")

      try {
        const response = await fetch("/api/chat/token", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        })

        if (!response.ok) {
          throw new Error("Unable to authenticate chat connection.")
        }

        const { token, wsUrl } = (await response.json()) as {
          token: string
          wsUrl: string
        }

        const nextUrl = new URL(wsUrl)
        nextUrl.searchParams.set("token", token)

        const socket = new window.WebSocket(nextUrl)
        socketRef.current = socket

        socket.onopen = () => {
          reconnectAttempt = 0
          setConnectionState("open")
          socket.send(JSON.stringify({ type: "presence:heartbeat", data: {} }))
          heartbeatTimer = window.setInterval(() => {
            if (socket.readyState !== window.WebSocket.OPEN) {
              return
            }

            socket.send(JSON.stringify({ type: "presence:heartbeat", data: {} }))
          }, PRESENCE_HEARTBEAT_MS)
        }

        socket.onmessage = (event) => {
          handleServerEvent(event.data)
        }

        socket.onerror = () => {
          socket.close()
        }

        socket.onclose = () => {
          clearHeartbeat()

          if (socketRef.current === socket) {
            socketRef.current = null
          }

          if (disposed) {
            return
          }

          scheduleReconnect()
        }
      } catch (error) {
        if (!disposed) {
          scheduleReconnect()
        }

        if (error instanceof Error) {
          console.error("Chat websocket connection failed.", error)
        }
      }
    }

    void connect()

    return () => {
      disposed = true
      clearHeartbeat()

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
      }

      closeSocket()
    }
  }, [sessionUserId])

  const hydrateInbox = useCallback((conversations: InboxConversationItem[]) => {
    setInboxConversations((current) => {
      const nextState = { ...current }

      for (const conversation of conversations) {
        nextState[conversation.id] = mergeInboxConversation(nextState[conversation.id], conversation)
      }

      return nextState
    })
    setPresenceByUser((current) => {
      const nextState = { ...current }

      for (const conversation of conversations) {
        if (!nextState[conversation.otherUser.id]) {
          nextState[conversation.otherUser.id] = {
            userId: conversation.otherUser.id,
            isOnline: false,
            lastSeenAt: conversation.otherUser.lastSeenAt ?? null,
          }
        }
      }

      return nextState
    })
  }, [])

  const sendMessage = useCallback(
    (input: {
      conversationId?: string
      recipientId?: string
      kind?: "TEXT" | "VIDEO_SHARE"
      content?: string | null
      videoId?: string
      clientMessageId?: string
    }) => {
      if (socketRef.current?.readyState !== window.WebSocket.OPEN) {
        return false
      }

      socketRef.current.send(
        JSON.stringify({
          type: "message:send",
          data: input,
        })
      )

      return true
    },
    []
  )

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (socketRef.current?.readyState !== window.WebSocket.OPEN) {
      return false
    }

    socketRef.current.send(
      JSON.stringify({
        type: isTyping ? "typing:start" : "typing:stop",
        data: {
          conversationId,
        },
      })
    )

    return true
  }, [])

  const markConversationRead = useCallback((input: { conversationId: string; messageId?: string }) => {
    if (socketRef.current?.readyState !== window.WebSocket.OPEN) {
      return false
    }

    socketRef.current.send(
      JSON.stringify({
        type: "message:read",
        data: input,
      })
    )

    return true
  }, [])

  const toggleReaction = useCallback((input: { messageId: string; emoji: string }) => {
    if (socketRef.current?.readyState !== window.WebSocket.OPEN) {
      return false
    }

    socketRef.current.send(
      JSON.stringify({
        type: "reaction:toggle",
        data: input,
      })
    )

    return true
  }, [])

  const value = useMemo(
    () => ({
      connectionState,
      totalUnreadCount,
      inboxConversations,
      messagesByConversation,
      typingByConversation,
      presenceByUser,
      seenReceiptsByConversation,
      hydrateInbox,
      sendMessage,
      sendTyping,
      markConversationRead,
      toggleReaction,
    }),
    [
      connectionState,
      hydrateInbox,
      inboxConversations,
      markConversationRead,
      messagesByConversation,
      presenceByUser,
      seenReceiptsByConversation,
      sendMessage,
      sendTyping,
      toggleReaction,
      totalUnreadCount,
      typingByConversation,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const value = useContext(ChatContext)

  if (!value) {
    throw new Error("useChat must be used within ChatProvider.")
  }

  return value
}
