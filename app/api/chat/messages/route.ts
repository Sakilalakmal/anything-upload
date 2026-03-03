import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth-guards"
import { sendMessageFromUser } from "@/lib/chat/service"
import { sendMessageInputSchema } from "@/lib/chat/validations"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Unable to send message."
}

export async function POST(request: NextRequest) {
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
    const parsed = sendMessageInputSchema.parse(await request.json())
    const result = await sendMessageFromUser({
      senderId: user.id,
      conversationId: parsed.conversationId,
      recipientId: parsed.recipientId,
      content: parsed.content,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      {
        status: 400,
      }
    )
  }
}
