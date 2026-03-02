import "server-only"

import { Prisma, VideoStatus, VideoVisibility } from "@prisma/client"
import { z } from "zod"

import { requireUser } from "@/lib/auth-guards"
import { decodeCursor, normalizeLimit, toCursorPage } from "@/lib/data/pagination"
import { prisma } from "@/lib/prisma"
import { profileUpdateSchema } from "@/lib/validations/users"

const userIdentifierSchema = z.string().trim().min(1, "User identifier is required.").max(64)

export class UsernameAlreadyInUseError extends Error {
  constructor(message = "Username is already taken.") {
    super(message)
    this.name = "UsernameAlreadyInUseError"
  }
}

export type UserProfileVideosQuery = {
  identifier: string
  viewerId?: string | null
  cursor?: string | null
  limit?: number
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

const userProfileSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  username: true,
  bio: true,
  avatarUrl: true,
  createdAt: true,
} as const

export async function fetchUserProfileWithVideos(query: UserProfileVideosQuery) {
  const identifier = userIdentifierSchema.parse(query.identifier)
  const limit = normalizeLimit(query.limit)
  const parsedCursor = decodeCursor(query.cursor)
  const normalizedIdentifier = identifier.toLowerCase()

  const userFromId = await prisma.user.findUnique({
    where: { id: identifier },
    select: userProfileSelect,
  })

  const user =
    userFromId ??
    (await prisma.user.findUnique({
      where: { username: normalizedIdentifier },
      select: userProfileSelect,
    }))

  if (!user) {
    return null
  }

  const isOwner = Boolean(query.viewerId && user.id === query.viewerId)
  const videoScope: Prisma.VideoWhereInput = isOwner
    ? { userId: user.id }
    : {
        userId: user.id,
        visibility: VideoVisibility.PUBLIC,
        status: VideoStatus.READY,
      }

  const [videos, videosCount, followersCount, followingCount, totalLikesReceived, followRecord] = await Promise.all([
    prisma.video.findMany({
      where: videoScope,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(parsedCursor
        ? {
            cursor: {
              createdAt_id: {
                createdAt: parsedCursor.createdAt,
                id: parsedCursor.id,
              },
            },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        status: true,
        thumbnailUrl: true,
        durationSec: true,
        createdAt: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    }),
    prisma.video.count({ where: videoScope }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.like.count({
      where: {
        video: videoScope,
      },
    }),
    query.viewerId && !isOwner
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: query.viewerId,
              followingId: user.id,
            },
          },
          select: {
            followerId: true,
          },
        })
      : Promise.resolve(null),
  ])

  const pagedVideos = toCursorPage(videos, limit)

  return {
    user,
    viewer: {
      isOwner,
      isFollowing: Boolean(followRecord),
    },
    stats: {
      videos: videosCount,
      followers: followersCount,
      following: followingCount,
      likesReceived: totalLikesReceived,
    },
    videos: pagedVideos.items,
    nextCursor: pagedVideos.nextCursor,
  }
}

export async function updateCurrentUserProfile(input: unknown) {
  const sessionUser = await requireUser()
  const parsed = profileUpdateSchema.parse(input)

  try {
    return await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        name: parsed.name,
        username: parsed.username,
        bio: parsed.bio,
      },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new UsernameAlreadyInUseError()
    }

    throw error
  }
}
