import "server-only"

import { Prisma, VideoVisibility } from "@prisma/client"
import { z } from "zod"

import { requireUser } from "@/lib/auth-guards"
import { prisma } from "@/lib/prisma"
import { addCommentSchema } from "@/lib/validations/social"

const cuidSchema = z.string().cuid("Invalid id.")

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

async function ensureVideoIsInteractable(videoId: string, viewerId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      userId: true,
      visibility: true,
    },
  })

  if (!video) {
    throw new Error("Video not found.")
  }

  const canInteract = video.visibility !== VideoVisibility.PRIVATE || video.userId === viewerId

  if (!canInteract) {
    throw new Error("You do not have access to this video.")
  }
}

export async function likeVideo(videoId: string) {
  const user = await requireUser()
  const parsedVideoId = cuidSchema.parse(videoId)

  await ensureVideoIsInteractable(parsedVideoId, user.id)

  try {
    await prisma.like.create({
      data: {
        userId: user.id,
        videoId: parsedVideoId,
      },
    })

    return {
      liked: true,
      changed: true,
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        liked: true,
        changed: false,
      }
    }

    throw error
  }
}

export async function unlikeVideo(videoId: string) {
  const user = await requireUser()
  const parsedVideoId = cuidSchema.parse(videoId)

  const result = await prisma.like.deleteMany({
    where: {
      userId: user.id,
      videoId: parsedVideoId,
    },
  })

  return {
    liked: false,
    changed: result.count > 0,
  }
}

export async function addComment(input: unknown) {
  const user = await requireUser()
  const parsed = addCommentSchema.parse(input)

  await ensureVideoIsInteractable(parsed.videoId, user.id)

  return prisma.comment.create({
    data: {
      userId: user.id,
      videoId: parsed.videoId,
      content: parsed.content,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  })
}

export async function followUser(targetUserId: string) {
  const user = await requireUser()
  const parsedTargetId = cuidSchema.parse(targetUserId)

  if (user.id === parsedTargetId) {
    return {
      following: false,
      changed: false,
    }
  }

  const targetUserExists = await prisma.user.findUnique({
    where: { id: parsedTargetId },
    select: { id: true },
  })

  if (!targetUserExists) {
    throw new Error("User not found.")
  }

  try {
    await prisma.follow.create({
      data: {
        followerId: user.id,
        followingId: parsedTargetId,
      },
    })

    return {
      following: true,
      changed: true,
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        following: true,
        changed: false,
      }
    }

    throw error
  }
}

export async function unfollowUser(targetUserId: string) {
  const user = await requireUser()
  const parsedTargetId = cuidSchema.parse(targetUserId)

  const result = await prisma.follow.deleteMany({
    where: {
      followerId: user.id,
      followingId: parsedTargetId,
    },
  })

  return {
    following: false,
    changed: result.count > 0,
  }
}
