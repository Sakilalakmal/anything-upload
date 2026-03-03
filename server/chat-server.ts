import { createServer } from "node:http"

import type { IncomingMessage } from "node:http"
import type { Socket } from "node:net"
import type { Duplex } from "node:stream"
import { WebSocket, WebSocketServer, type RawData } from "ws"

import type { ChatServerEvent } from "../lib/chat/events"
import { chatClientEventSchema } from "../lib/chat/events"
import {
  getConversation,
  getConversationPartnerIds,
  getInboxConversation,
  getUnreadMessageCount,
  markConversationReadForUser,
  sendMessageFromUser,
  toggleReactionForUser,
  updateUserLastSeen,
} from "../lib/chat/service"
import { verifyChatToken } from "../lib/chat/token"
import { markReadInputSchema, sendMessageInputSchema, toggleReactionInputSchema } from "../lib/chat/validations"
import { prisma } from "../lib/prisma"

const PORT = Number.parseInt(process.env.CHAT_WS_PORT ?? "3001", 10) || 3001
const MAX_MESSAGES_PER_WINDOW = 5
const MESSAGE_RATE_LIMIT_WINDOW_MS = 2_000
const MAX_REACTIONS_PER_WINDOW = 12
const REACTION_RATE_LIMIT_WINDOW_MS = 3_000
const READ_THROTTLE_MS = 400
const PRESENCE_WRITE_THROTTLE_MS = 45_000

type AuthedSocket = WebSocket & {
  userId: string
  activeTypingConversationIds: Set<string>
  cleanupStarted?: boolean
}

const socketsByUser = new Map<string, Set<AuthedSocket>>()
const sendWindowsByUser = new Map<string, number[]>()
const reactionWindowsByUser = new Map<string, number[]>()
const lastReadEventByConversationUser = new Map<string, number>()
const lastPresenceWriteByUser = new Map<string, number>()
const wss = new WebSocketServer({ noServer: true })

function sendEvent(socket: WebSocket, event: ChatServerEvent) {
  if (socket.readyState !== WebSocket.OPEN) {
    return
  }

  socket.send(JSON.stringify(event))
}

function sendError(socket: WebSocket, code: string, message: string) {
  sendEvent(socket, {
    type: "error",
    data: {
      code,
      message,
    },
  })
}

function isUserOnline(userId: string) {
  return Boolean(socketsByUser.get(userId)?.size)
}

function registerSocket(socket: AuthedSocket) {
  const existingSockets = socketsByUser.get(socket.userId) ?? new Set<AuthedSocket>()
  existingSockets.add(socket)
  socketsByUser.set(socket.userId, existingSockets)
}

function unregisterSocket(socket: AuthedSocket) {
  const userSockets = socketsByUser.get(socket.userId)

  if (!userSockets) {
    sendWindowsByUser.delete(socket.userId)
    reactionWindowsByUser.delete(socket.userId)
    return
  }

  userSockets.delete(socket)

  if (userSockets.size === 0) {
    socketsByUser.delete(socket.userId)
    sendWindowsByUser.delete(socket.userId)
    reactionWindowsByUser.delete(socket.userId)
  }
}

function broadcastToUsers(userIds: string[], event: ChatServerEvent, skipUserId?: string) {
  const deliveredUserIds = new Set<string>()

  for (const userId of userIds) {
    if (skipUserId && userId === skipUserId) {
      continue
    }

    if (deliveredUserIds.has(userId)) {
      continue
    }

    deliveredUserIds.add(userId)
    const sockets = socketsByUser.get(userId)

    if (!sockets?.size) {
      continue
    }

    for (const socket of sockets) {
      sendEvent(socket, event)
    }
  }
}

function consumeRateLimit(windowStore: Map<string, number[]>, key: string, maxCount: number, windowMs: number) {
  const now = Date.now()
  const existingWindow = windowStore.get(key) ?? []
  const nextWindow = existingWindow.filter((timestamp) => now - timestamp < windowMs)

  if (nextWindow.length >= maxCount) {
    windowStore.set(key, nextWindow)
    return false
  }

  nextWindow.push(now)
  windowStore.set(key, nextWindow)
  return true
}

function shouldThrottleRead(userId: string, conversationId: string) {
  const key = `${userId}:${conversationId}`
  const now = Date.now()
  const lastSeen = lastReadEventByConversationUser.get(key) ?? 0

  if (now - lastSeen < READ_THROTTLE_MS) {
    return true
  }

  lastReadEventByConversationUser.set(key, now)
  return false
}

async function emitInboxUpdate(userId: string, conversationId: string) {
  const [conversation, totalUnreadCount] = await Promise.all([
    getInboxConversation(conversationId, userId),
    getUnreadMessageCount(userId),
  ])

  if (!conversation) {
    return
  }

  broadcastToUsers([userId], {
    type: "inbox:update",
    data: {
      conversation,
      totalUnreadCount,
    },
  })
}

async function broadcastPresenceUpdate(userId: string, isOnline: boolean, lastSeenAt: string | null) {
  const audienceUserIds = await getConversationPartnerIds(userId)

  if (!audienceUserIds.length) {
    return
  }

  broadcastToUsers(audienceUserIds, {
    type: "presence:update",
    data: {
      userId,
      isOnline,
      lastSeenAt,
    },
  })
}

async function syncPresenceToSocket(socket: AuthedSocket) {
  const audienceUserIds = await getConversationPartnerIds(socket.userId)

  if (!audienceUserIds.length) {
    return
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: audienceUserIds,
      },
    },
    select: {
      id: true,
      lastSeenAt: true,
    },
  })

  for (const user of users) {
    sendEvent(socket, {
      type: "presence:update",
      data: {
        userId: user.id,
        isOnline: isUserOnline(user.id),
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      },
    })
  }
}

async function touchPresence(userId: string, force = false) {
  const now = Date.now()
  const lastWriteAt = lastPresenceWriteByUser.get(userId) ?? 0

  if (!force && now - lastWriteAt < PRESENCE_WRITE_THROTTLE_MS) {
    return null
  }

  const lastSeenAt = await updateUserLastSeen(userId, new Date(now))
  lastPresenceWriteByUser.set(userId, now)
  return lastSeenAt
}

async function handleMessageSend(socket: AuthedSocket, rawData: unknown) {
  if (!consumeRateLimit(sendWindowsByUser, socket.userId, MAX_MESSAGES_PER_WINDOW, MESSAGE_RATE_LIMIT_WINDOW_MS)) {
    sendError(socket, "rate_limited", "Too many messages. Try again in a moment.")
    return
  }

  const parsed = sendMessageInputSchema.safeParse(rawData)

  if (!parsed.success) {
    sendError(socket, "invalid_payload", parsed.error.issues[0]?.message ?? "Invalid message payload.")
    return
  }

  const data = parsed.data

  const result = await sendMessageFromUser({
    senderId: socket.userId,
    conversationId: data.conversationId,
    recipientId: data.recipientId,
    kind: data.kind,
    content: data.content,
    videoId: data.videoId,
  })

  socket.activeTypingConversationIds.delete(result.conversation.id)

  broadcastToUsers(result.conversation.memberIds, {
    type: "message:new",
    data: {
      conversationId: result.conversation.id,
      clientMessageId: data.clientMessageId ?? null,
      message: result.message,
    },
  })

  broadcastToUsers(
    result.conversation.memberIds,
    {
      type: "typing",
      data: {
        conversationId: result.conversation.id,
        userId: socket.userId,
        isTyping: false,
      },
    },
    socket.userId
  )

  await Promise.all(result.conversation.memberIds.map((userId) => emitInboxUpdate(userId, result.conversation.id)))
}

async function handleTyping(socket: AuthedSocket, conversationId: string, isTyping: boolean) {
  const conversation = await getConversation(conversationId, socket.userId)

  if (!conversation) {
    sendError(socket, "not_found", "Conversation not found.")
    return
  }

  if (isTyping) {
    socket.activeTypingConversationIds.add(conversationId)
  } else {
    socket.activeTypingConversationIds.delete(conversationId)
  }

  broadcastToUsers(
    conversation.memberIds,
    {
      type: "typing",
      data: {
        conversationId,
        userId: socket.userId,
        isTyping,
      },
    },
    socket.userId
  )
}

async function handleRead(socket: AuthedSocket, rawData: unknown) {
  const parsed = markReadInputSchema.safeParse(rawData)

  if (!parsed.success) {
    sendError(socket, "invalid_payload", parsed.error.issues[0]?.message ?? "Invalid read payload.")
    return
  }

  const data = parsed.data

  if (shouldThrottleRead(socket.userId, data.conversationId)) {
    return
  }

  const conversation = await getConversation(data.conversationId, socket.userId)

  if (!conversation) {
    sendError(socket, "not_found", "Conversation not found.")
    return
  }

  const result = await markConversationReadForUser({
    conversationId: data.conversationId,
    userId: socket.userId,
    messageId: data.messageId,
  })

  broadcastToUsers(conversation.memberIds, {
    type: "message:seen",
    data: {
      conversationId: result.conversationId,
      userId: socket.userId,
      messageId: result.messageId,
      lastReadAt: result.lastReadAt,
    },
  })

  await Promise.all(conversation.memberIds.map((userId) => emitInboxUpdate(userId, result.conversationId)))
}

async function handleReactionToggle(socket: AuthedSocket, rawData: unknown) {
  if (!consumeRateLimit(reactionWindowsByUser, socket.userId, MAX_REACTIONS_PER_WINDOW, REACTION_RATE_LIMIT_WINDOW_MS)) {
    sendError(socket, "rate_limited", "Too many reactions. Try again in a moment.")
    return
  }

  const parsed = toggleReactionInputSchema.safeParse(rawData)

  if (!parsed.success) {
    sendError(socket, "invalid_payload", parsed.error.issues[0]?.message ?? "Invalid reaction payload.")
    return
  }

  const result = await toggleReactionForUser({
    userId: socket.userId,
    messageId: parsed.data.messageId,
    emoji: parsed.data.emoji,
  })

  broadcastToUsers(result.memberIds, {
    type: "reaction:update",
    data: {
      messageId: result.messageId,
      reactionsSummary: result.reactionsSummary,
    },
  })
}

async function clearTypingState(socket: AuthedSocket) {
  const activeConversationIds = [...socket.activeTypingConversationIds]
  socket.activeTypingConversationIds.clear()

  await Promise.all(
    activeConversationIds.map(async (conversationId) => {
      try {
        const conversation = await getConversation(conversationId, socket.userId)

        if (!conversation) {
          return
        }

        broadcastToUsers(
          conversation.memberIds,
          {
            type: "typing",
            data: {
              conversationId,
              userId: socket.userId,
              isTyping: false,
            },
          },
          socket.userId
        )
      } catch (error) {
        console.error("Typing cleanup failed.", error)
      }
    })
  )
}

async function handleSocketMessage(socket: AuthedSocket, rawBuffer: RawData) {
  let payload: unknown

  try {
    payload = JSON.parse(rawBuffer.toString())
  } catch {
    sendError(socket, "invalid_json", "Message payload must be valid JSON.")
    return
  }

  const parsedEvent = chatClientEventSchema.safeParse(payload)

  if (!parsedEvent.success) {
    sendError(socket, "invalid_event", parsedEvent.error.issues[0]?.message ?? "Invalid websocket event.")
    return
  }

  const event = parsedEvent.data

  try {
    switch (event.type) {
      case "message:send":
        await handleMessageSend(socket, event.data)
        return
      case "typing:start":
        await handleTyping(socket, event.data.conversationId, true)
        return
      case "typing:stop":
        await handleTyping(socket, event.data.conversationId, false)
        return
      case "message:read":
        await handleRead(socket, event.data)
        return
      case "reaction:toggle":
        await handleReactionToggle(socket, event.data)
        return
      case "presence:heartbeat":
        await touchPresence(socket.userId)
        return
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Websocket request failed."
    sendError(socket, "request_failed", message)
  }
}

function rejectUpgrade(socket: Socket | Duplex, statusCode: number, statusText: string) {
  socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\n\r\n`)
  socket.destroy()
}

async function authenticateUpgrade(request: IncomingMessage) {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
  const token = requestUrl.searchParams.get("token")

  if (!token) {
    throw new Error("Missing token.")
  }

  return verifyChatToken(token)
}

async function handleSocketDisconnected(socket: AuthedSocket) {
  if (socket.cleanupStarted) {
    return
  }

  socket.cleanupStarted = true
  await clearTypingState(socket)

  if (isUserOnline(socket.userId)) {
    return
  }

  const lastSeenAt = await touchPresence(socket.userId, true)
  await broadcastPresenceUpdate(socket.userId, false, lastSeenAt)
}

wss.on("connection", (socket) => {
  const authedSocket = socket as AuthedSocket
  const wasOnline = isUserOnline(authedSocket.userId)

  registerSocket(authedSocket)

  void (async () => {
    try {
      await syncPresenceToSocket(authedSocket)

      if (!wasOnline) {
        const lastSeenAt = await touchPresence(authedSocket.userId, true)
        await broadcastPresenceUpdate(authedSocket.userId, true, lastSeenAt)
      }
    } catch (error) {
      console.error("Presence sync failed.", error)
    }
  })()

  socket.on("message", (buffer) => {
    void handleSocketMessage(authedSocket, buffer)
  })

  socket.on("close", () => {
    unregisterSocket(authedSocket)
    void handleSocketDisconnected(authedSocket)
  })

  socket.on("error", (error) => {
    console.error("Chat websocket error.", error)
    unregisterSocket(authedSocket)
    void handleSocketDisconnected(authedSocket)
  })
})

const server = createServer((_request, response) => {
  response.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
  })
  response.end("Chat websocket server is running.\n")
})

server.on("upgrade", (request, socket, head) => {
  void (async () => {
    try {
      const { userId } = await authenticateUpgrade(request)

      wss.handleUpgrade(request, socket, head, (upgradedSocket) => {
        const authedSocket = upgradedSocket as AuthedSocket
        authedSocket.userId = userId
        authedSocket.activeTypingConversationIds = new Set<string>()
        wss.emit("connection", authedSocket, request)
      })
    } catch {
      rejectUpgrade(socket, 401, "Unauthorized")
    }
  })()
})

async function shutdown() {
  for (const sockets of socketsByUser.values()) {
    for (const socket of sockets) {
      socket.close(1001, "Server shutting down")
    }
  }

  await prisma.$disconnect()

  server.close(() => {
    process.exit(0)
  })
}

process.on("SIGINT", () => {
  void shutdown()
})

process.on("SIGTERM", () => {
  void shutdown()
})

server.listen(PORT, () => {
  console.log(`Chat websocket server listening on ws://localhost:${PORT}`)
})
