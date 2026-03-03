import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth-guards"
import { getMessages } from "@/lib/chat/service"

type RouteProps = {
  params: Promise<{
    conversationId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteProps) {
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

  const { conversationId } = await params
  const cursor = request.nextUrl.searchParams.get("cursor")

  try {
    const page = await getMessages({
      conversationId,
      userId: user.id,
      cursor,
    })

    return NextResponse.json(page)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load messages."

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
