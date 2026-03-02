import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth-guards"
import { getNotifications } from "@/lib/data/notifications"
import { inboxTabSchema } from "@/lib/validations/notifications"

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

  const cursor = request.nextUrl.searchParams.get("cursor")
  const tab = inboxTabSchema.catch("all").parse(request.nextUrl.searchParams.get("tab"))

  try {
    const page = await getNotifications({
      recipientId: user.id,
      cursor,
      filterUnread: tab === "unread",
    })

    return NextResponse.json(page)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notifications."

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
