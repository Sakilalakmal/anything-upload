import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth-guards"
import { listShareableVideosForUser } from "@/lib/chat/service"

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

  try {
    const videos = await listShareableVideosForUser({
      userId: user.id,
      query: request.nextUrl.searchParams.get("q"),
    })

    return NextResponse.json({
      items: videos,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load videos.",
      },
      {
        status: 400,
      }
    )
  }
}
