"use client"

import Link from "next/link"
import { Inbox } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useNotifications } from "@/components/notifications/notifications-provider"
import { cn } from "@/lib/utils"

function formatBadgeCount(count: number) {
  if (count <= 0) {
    return null
  }

  return count > 9 ? "9+" : String(count)
}

export function InboxNavLink({ className }: { className?: string }) {
  const { unreadCount } = useNotifications()
  const badgeCount = formatBadgeCount(unreadCount)

  return (
    <Button asChild variant="ghost" className={cn("relative", className)}>
      <Link href="/inbox?tab=all" prefetch={false} aria-label={badgeCount ? `Inbox with ${badgeCount} unread notifications` : "Inbox"}>
        <Inbox className="size-4" />
        Inbox
        {badgeCount ? (
          <span
            key={unreadCount}
            className={cn(
              "absolute -top-1 -right-1 inline-flex min-w-5 animate-in zoom-in-50 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm duration-200"
            )}
          >
            {badgeCount}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}
