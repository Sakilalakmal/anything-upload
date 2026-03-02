import "server-only"

import { randomUUID } from "node:crypto"

import type { RealtimeNotificationEvent } from "@/lib/realtime/notifications-events"

type Subscriber = (event: RealtimeNotificationEvent) => void

type NotificationsHubState = {
  listenersByUser: Map<string, Map<string, Subscriber>>
}

const globalForNotificationsHub = globalThis as typeof globalThis & {
  __notificationsHub?: NotificationsHubState
}

function getHubState(): NotificationsHubState {
  if (!globalForNotificationsHub.__notificationsHub) {
    globalForNotificationsHub.__notificationsHub = {
      listenersByUser: new Map(),
    }
  }

  return globalForNotificationsHub.__notificationsHub
}

export function subscribe(userId: string, sendFn: Subscriber) {
  const state = getHubState()
  const subscriberId = randomUUID()
  const listeners = state.listenersByUser.get(userId) ?? new Map<string, Subscriber>()

  listeners.set(subscriberId, sendFn)
  state.listenersByUser.set(userId, listeners)

  return () => {
    const currentListeners = state.listenersByUser.get(userId)

    if (!currentListeners) {
      return
    }

    currentListeners.delete(subscriberId)

    if (currentListeners.size === 0) {
      state.listenersByUser.delete(userId)
    }
  }
}

export function emitToUser(userId: string, event: RealtimeNotificationEvent) {
  const listeners = getHubState().listenersByUser.get(userId)

  if (!listeners?.size) {
    return 0
  }

  let deliveredCount = 0

  for (const [subscriberId, sendFn] of listeners.entries()) {
    try {
      sendFn(event)
      deliveredCount += 1
    } catch {
      listeners.delete(subscriberId)
    }
  }

  if (listeners.size === 0) {
    getHubState().listenersByUser.delete(userId)
  }

  return deliveredCount
}
