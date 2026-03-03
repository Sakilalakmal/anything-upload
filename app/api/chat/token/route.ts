import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth-guards"
import { getChatWsUrl } from "@/lib/chat/config"
import { mintChatToken } from "@/lib/chat/token"

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

  const { token, expiresAt } = await mintChatToken(user.id)

  return NextResponse.json({
    token,
    wsUrl: getChatWsUrl(),
    expiresAt: expiresAt.toISOString(),
  })
}
