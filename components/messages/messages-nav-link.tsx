"use client"

import Link from "next/link"
import { MessageCircleMore } from "lucide-react"

import { useChat } from "@/components/realtime/chat-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatBadgeCount(count: number) {
  if (count <= 0) {
    return null
  }

  return count > 9 ? "9+" : String(count)
}

export function MessagesNavLink({ className }: { className?: string }) {
  const { totalUnreadCount } = useChat()
  const badgeCount = formatBadgeCount(totalUnreadCount)

  return (
    <Button asChild variant="ghost" className={cn("relative", className)}>
      <Link
        href="/messages"
        prefetch={false}
        aria-label={badgeCount ? `Messages with ${badgeCount} unread conversations` : "Messages"}
      >
        <MessageCircleMore className="size-4" />
        Messages
        {badgeCount ? (
          <span
            key={totalUnreadCount}
            className="absolute -top-1 -right-1 inline-flex min-w-5 animate-in zoom-in-50 items-center justify-center rounded-full bg-[#0f766e] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm duration-200"
          >
            {badgeCount}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}
