"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

type NotificationsContextValue = {
  unreadCount: number
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({
  initialUnreadCount,
  children,
}: {
  initialUnreadCount: number
  children: React.ReactNode
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  const value = useMemo(
    () => ({
      unreadCount,
      setUnreadCount,
    }),
    [unreadCount]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const value = useContext(NotificationsContext)

  if (!value) {
    throw new Error("useNotifications must be used within NotificationsProvider.")
  }

  return value
}
