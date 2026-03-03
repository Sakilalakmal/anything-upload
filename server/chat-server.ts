import { createServer } from "node:http"

import type { IncomingMessage } from "node:http"
import type { Socket } from "node:net"
import type { Duplex } from "node:stream"
import { WebSocketServer, WebSocket, type RawData } from "ws"

import type { ChatServerEvent } from "../lib/chat/events"
import { chatClientEventSchema } from "../lib/chat/events"
import {
  getConversation,
  getInboxConversation,
  getUnreadMessageCount,
  markConversationReadForUser,
  sendMessageFromUser,
} from "../lib/chat/service"
import { verifyChatToken } from "../lib/chat/token"
import { markReadInputSchema, sendMessageInputSchema } from "../lib/chat/validations"
import { prisma } from "../lib/prisma"

const PORT = Number.parseInt(process.env.CHAT_WS_PORT ?? "3001", 10) || 3001
const MAX_MESSAGES_PER_WINDOW = 5
const RATE_LIMIT_WINDOW_MS = 2_000

type AuthedSocket = WebSocket & {
  userId: string
  activeTypingConversationIds: Set<string>
}

const socketsByUser = new Map<string, Set<AuthedSocket>>()
const sendWindowsByUser = new Map<string, number[]>()
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

function registerSocket(socket: AuthedSocket) {
  const existingSockets = socketsByUser.get(socket.userId) ?? new Set<AuthedSocket>()
  existingSockets.add(socket)
  socketsByUser.set(socket.userId, existingSockets)
}

function unregisterSocket(socket: AuthedSocket) {
  const userSockets = socketsByUser.get(socket.userId)

  if (!userSockets) {
    sendWindowsByUser.delete(socket.userId)
    return
  }

  userSockets.delete(socket)

  if (userSockets.size === 0) {
    socketsByUser.delete(socket.userId)
    sendWindowsByUser.delete(socket.userId)
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

function consumeRateLimit(userId: string) {
  const now = Date.now()
  const existingWindow = sendWindowsByUser.get(userId) ?? []
  const nextWindow = existingWindow.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)

  if (nextWindow.length >= MAX_MESSAGES_PER_WINDOW) {
    sendWindowsByUser.set(userId, nextWindow)
    return false
  }

  nextWindow.push(now)
  sendWindowsByUser.set(userId, nextWindow)
  return true
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

async function handleMessageSend(socket: AuthedSocket, rawData: unknown) {
  if (!consumeRateLimit(socket.userId)) {
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
    content: data.content,
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
    type: "message:read",
    data: {
      conversationId: result.conversationId,
      userId: socket.userId,
      messageId: result.messageId,
      lastReadAt: result.lastReadAt,
    },
  })

  await emitInboxUpdate(socket.userId, result.conversationId)
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

wss.on("connection", (socket) => {
  const authedSocket = socket as AuthedSocket
  registerSocket(authedSocket)

  socket.on("message", (buffer) => {
    void handleSocketMessage(authedSocket, buffer)
  })

  socket.on("close", () => {
    unregisterSocket(authedSocket)
    void clearTypingState(authedSocket)
  })

  socket.on("error", (error) => {
    console.error("Chat websocket error.", error)
    unregisterSocket(authedSocket)
    void clearTypingState(authedSocket)
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
