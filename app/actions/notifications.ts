"use server"

import { revalidatePath } from "next/cache"

import { requireUserOrThrow } from "@/lib/auth-guards"
import { markAllRead, markNotificationRead } from "@/lib/data/notifications"
import { notificationIdSchema } from "@/lib/validations/notifications"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

function revalidateNotificationViews() {
  revalidatePath("/inbox")
  revalidatePath("/", "layout")
}

export async function markNotificationReadAction(input: unknown) {
  const user = await requireUserOrThrow()
  const parsed = notificationIdSchema.safeParse(
    typeof input === "object" && input !== null ? (input as { notificationId?: unknown }).notificationId : input
  )

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid notification.",
    }
  }

  try {
    const changed = await markNotificationRead({
      notificationId: parsed.data,
      recipientId: user.id,
    })

    revalidateNotificationViews()

    return {
      success: true as const,
      changed,
    }
  } catch (error) {
    return {
      success: false as const,
      error: getErrorMessage(error),
    }
  }
}

export async function markAllNotificationsReadAction() {
  const user = await requireUserOrThrow()

  try {
    const updatedCount = await markAllRead(user.id)

    revalidateNotificationViews()

    return {
      success: true as const,
      updatedCount,
    }
  } catch (error) {
    return {
      success: false as const,
      error: getErrorMessage(error),
    }
  }
}
