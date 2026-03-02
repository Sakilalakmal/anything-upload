import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth-guards"
import { getUnreadCount } from "@/lib/data/notifications"
import { subscribe } from "@/lib/realtime/notifications-hub"
import { createUnreadCountChangedEvent, type RealtimeNotificationEvent } from "@/lib/realtime/notifications-events"

const HEARTBEAT_INTERVAL_MS = 25_000

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function encodeSseEvent(event: RealtimeNotificationEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

function encodeHeartbeat() {
  return `event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      {
        error: "You must be signed in.",
      },
      {
        status: 401,
      }
    )
  }

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  let closed = false
  let unsubscribe: (() => void) | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let pendingWrite = Promise.resolve()

  const cleanup = () => {
    if (closed) {
      return
    }

    closed = true
    unsubscribe?.()
    unsubscribe = null

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }

    pendingWrite = pendingWrite.finally(async () => {
      try {
        await writer.close()
      } catch {
        return
      }
    })
  }

  const sendChunk = (chunk: string) => {
    if (closed) {
      return
    }

    pendingWrite = pendingWrite
      .then(() => writer.write(encoder.encode(chunk)))
      .catch(() => {
        cleanup()
      })
  }

  unsubscribe = subscribe(user.id, (event) => {
    sendChunk(encodeSseEvent(event))
  })

  try {
    const unreadCount = await getUnreadCount(user.id)
    sendChunk(encodeSseEvent(createUnreadCountChangedEvent(unreadCount)))
  } catch {
    cleanup()

    return NextResponse.json(
      {
        error: "Unable to start realtime notifications.",
      },
      {
        status: 500,
      }
    )
  }

  heartbeatTimer = setInterval(() => {
    sendChunk(encodeHeartbeat())
  }, HEARTBEAT_INTERVAL_MS)

  request.signal.addEventListener("abort", cleanup, { once: true })

  return new NextResponse(stream.readable, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  })
}
