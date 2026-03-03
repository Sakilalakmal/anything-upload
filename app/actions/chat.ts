"use server"

import { revalidatePath } from "next/cache"

import { requireUserOrThrow } from "@/lib/auth-guards"
import {
  listShareableVideosForUser,
  markConversationReadForUser,
  sendMessageFromUser,
  toggleReactionForUser,
} from "@/lib/chat/service"
import { markReadInputSchema, sendMessageInputSchema, toggleReactionInputSchema } from "@/lib/chat/validations"

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
      kind: parsed.data.kind,
      content: parsed.data.content,
      videoId: parsed.data.videoId,
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

export async function toggleReactionAction(input: unknown) {
  const user = await requireUserOrThrow()
  const parsed = toggleReactionInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid reaction request.",
    }
  }

  try {
    const result = await toggleReactionForUser({
      messageId: parsed.data.messageId,
      userId: user.id,
      emoji: parsed.data.emoji,
    })

    revalidateMessagesViews(result.conversationId)

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

export async function getShareableVideosAction(query?: string | null) {
  const user = await requireUserOrThrow()

  try {
    const videos = await listShareableVideosForUser({
      userId: user.id,
      query,
    })

    return {
      success: true as const,
      videos,
    }
  } catch (error) {
    return {
      success: false as const,
      error: getErrorMessage(error),
      videos: [],
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
