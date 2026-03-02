import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth-guards"
import { getUnreadCount } from "@/lib/data/notifications"

export const dynamic = "force-dynamic"

export async function GET() {
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

  try {
    const unreadCount = await getUnreadCount(user.id)

    return NextResponse.json({
      unreadCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load unread count."

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      }
    )
  }
}
