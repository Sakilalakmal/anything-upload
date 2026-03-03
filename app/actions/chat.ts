"use server"

import { revalidatePath } from "next/cache"

import { requireUserOrThrow } from "@/lib/auth-guards"
import {
  markConversationReadForUser,
  sendMessageFromUser,
} from "@/lib/chat/service"
import { markReadInputSchema, sendMessageInputSchema } from "@/lib/chat/validations"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

function revalidateMessagesViews(conversationId?: string) {
  revalidatePath("/messages")

  if (conversationId) {
    revalidatePath(`/messages/${conversationId}`)
  }
}

export async function sendMessageAction(input: unknown) {
  const user = await requireUserOrThrow()
  const parsed = sendMessageInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid message.",
    }
  }

  try {
    const result = await sendMessageFromUser({
      senderId: user.id,
      conversationId: parsed.data.conversationId,
      recipientId: parsed.data.recipientId,
      content: parsed.data.content,
    })

    revalidateMessagesViews(result.conversation.id)

    return {
      success: true as const,
      ...result,
    }
  } catch (error) {
    return {
      success: false as const,
      error: getErrorMessage(error),
    }
  }
}

export async function markConversationReadAction(input: unknown) {
  const user = await requireUserOrThrow()
  const parsed = markReadInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid read request.",
    }
  }

  try {
    const result = await markConversationReadForUser({
      conversationId: parsed.data.conversationId,
      userId: user.id,
      messageId: parsed.data.messageId,
    })

    revalidateMessagesViews(parsed.data.conversationId)

    return {
      success: true as const,
      ...result,
    }
  } catch (error) {
    return {
      success: false as const,
      error: getErrorMessage(error),
    }
  }
}
