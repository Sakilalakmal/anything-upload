"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createComment, toggleFollow, toggleLike } from "@/lib/data/social"
import { addCommentSchema, toggleFollowSchema, toggleLikeSchema } from "@/lib/validations/social"

const followActionSchema = toggleFollowSchema.extend({
  profilePath: z.string().optional(),
})

function normalizePath(path: string | undefined) {
  if (!path) {
    return null
  }

  return path.startsWith("/") && !path.startsWith("//") ? path : null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

export async function toggleLikeAction(input: unknown) {
  const parsed = toggleLikeSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid like request.",
    }
  }

  try {
    const result = await toggleLike(parsed.data.videoId)

    revalidatePath("/")
    revalidatePath(`/v/${parsed.data.videoId}`)

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

export async function createCommentAction(input: unknown) {
  const parsed = addCommentSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid comment.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const result = await createComment(parsed.data)

    revalidatePath("/")
    revalidatePath(`/v/${parsed.data.videoId}`)

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

export async function toggleFollowAction(input: unknown) {
  const parsed = followActionSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid follow request.",
    }
  }

  try {
    const result = await toggleFollow(parsed.data.targetUserId)
    const normalizedPath = normalizePath(parsed.data.profilePath)

    revalidatePath("/")
    revalidatePath("/profile")

    if (normalizedPath) {
      revalidatePath(normalizedPath)
    }

    revalidatePath(`/u/${parsed.data.targetUserId}`)

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
