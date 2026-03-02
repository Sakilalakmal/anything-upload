import "server-only"

import { Prisma, VideoStatus, VideoVisibility } from "@prisma/client"
import { formatDistanceToNow } from "date-fns"
import { z } from "zod"

import {
  type DiscoverTagOption,
  type DiscoverUserItem,
  type DiscoverUserPagePayload,
  type DiscoverVideoItem,
  type DiscoverVideoPagePayload,
} from "@/lib/data/discover-types"
import { decodeCursor, normalizeLimit, toCursorPage, type CursorPage } from "@/lib/data/pagination"
import { prisma } from "@/lib/prisma"
import { searchUsersInputSchema, searchVideosInputSchema, type SearchUsersInput, type SearchVideosInput } from "@/lib/validations/discover"

const DEFAULT_SEARCH_PAGE_SIZE = 12
const DEFAULT_DISCOVER_SECTION_SIZE = 8

const discoverVideoCursorSchema = z.object({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
  likeCount: z.number().int().min(0).optional(),
})

type DiscoverVideoCursor = z.infer<typeof discoverVideoCursorSchema>

type DiscoverVideoRow = {
  id: string
  title: string
  videoUrl: string
  thumbnailUrl: string | null
  createdAt: Date
  creatorId: string
  creatorUsername: string | null
  creatorName: string | null
  creatorAvatarUrl: string | null
  likeCount: number
  commentCount: number
}

type DiscoverUserRow = {
  id: string
  username: string | null
  name: string | null
  avatarUrl: string | null
  createdAt: Date
  followersCount: number
}

const discoverVideoSelect = {
  id: true,
  title: true,
  videoUrl: true,
  thumbnailUrl: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
    },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
    },
  },
} satisfies Prisma.VideoSelect

type DiscoverVideoRecord = Prisma.VideoGetPayload<{
  select: typeof discoverVideoSelect
}>

function encodeDiscoverVideoCursor(cursor: DiscoverVideoCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeDiscoverVideoCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null
  }

  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8")
    return discoverVideoCursorSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

function toLikePattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`
}

function buildVideoVisibilityClause(viewerId: string | null | undefined) {
  if (viewerId) {
    return Prisma.sql`(
      (
        v."visibility" = ${VideoVisibility.PUBLIC}
        AND v."status" = ${VideoStatus.READY}
      )
      OR (
        v."userId" = ${viewerId}
        AND v."status" = ${VideoStatus.READY}
      )
    )`
  }

  return Prisma.sql`(
    v."visibility" = ${VideoVisibility.PUBLIC}
    AND v."status" = ${VideoStatus.READY}
  )`
}

function buildVideoSearchClause(query: string) {
  const normalized = query.toLowerCase()
  const likePattern = toLikePattern(normalized)

  return Prisma.sql`(
    to_tsvector('simple', coalesce(v."title", '') || ' ' || coalesce(v."description", '')) @@ websearch_to_tsquery('simple', ${query})
    OR lower(v."title") LIKE ${likePattern} ESCAPE '\\'
    OR lower(coalesce(v."description", '')) LIKE ${likePattern} ESCAPE '\\'
  )`
}

function buildUserSearchClause(query: string) {
  const normalized = query.toLowerCase()
  const likePattern = toLikePattern(normalized)

  return Prisma.sql`(
    to_tsvector('simple', coalesce(u."username", '') || ' ' || coalesce(u."name", '')) @@ websearch_to_tsquery('simple', ${query})
    OR lower(coalesce(u."username", '')) LIKE ${likePattern} ESCAPE '\\'
    OR lower(coalesce(u."name", '')) LIKE ${likePattern} ESCAPE '\\'
  )`
}

function buildVideoTagClause(tag: string | null) {
  if (!tag) {
    return null
  }

  return Prisma.sql`EXISTS (
    SELECT 1
    FROM "VideoTag" vt
    INNER JOIN "Tag" t ON t.id = vt."tagId"
    WHERE vt."videoId" = v.id
      AND lower(t."name") = ${tag}
  )`
}

function toDiscoverVideoItem(video: DiscoverVideoRow | DiscoverVideoRecord): DiscoverVideoItem {
  if ("creatorId" in video) {
    return {
      id: video.id,
      title: video.title,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      createdAt: video.createdAt.toISOString(),
      createdAtRelative: formatDistanceToNow(video.createdAt, { addSuffix: true }),
      creator: {
        id: video.creatorId,
        username: video.creatorUsername,
        name: video.creatorName,
        avatarUrl: video.creatorAvatarUrl,
      },
      likeCount: video.likeCount,
      commentCount: video.commentCount,
    }
  }

  return {
    id: video.id,
    title: video.title,
    videoUrl: video.videoUrl as string,
    thumbnailUrl: video.thumbnailUrl,
    createdAt: video.createdAt.toISOString(),
    createdAtRelative: formatDistanceToNow(video.createdAt, { addSuffix: true }),
    creator: {
      id: video.user.id,
      username: video.user.username,
      name: video.user.name,
      avatarUrl: video.user.avatarUrl,
    },
    likeCount: video._count.likes,
    commentCount: video._count.comments,
  }
}

function toDiscoverUserItem(user: DiscoverUserRow): DiscoverUserItem {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
    followersCount: user.followersCount,
  }
}

export function serializeVideoSearchPage(page: CursorPage<DiscoverVideoRow>): DiscoverVideoPagePayload {
  return {
    items: page.items.map(toDiscoverVideoItem),
    nextCursor: page.nextCursor,
  }
}

export function serializeUserSearchPage(page: CursorPage<DiscoverUserRow>): DiscoverUserPagePayload {
  return {
    items: page.items.map(toDiscoverUserItem),
    nextCursor: page.nextCursor,
  }
}

export function serializeDiscoverVideoList(videos: DiscoverVideoRecord[]) {
  return videos.map(toDiscoverVideoItem)
}

export async function searchVideos(input: SearchVideosInput) {
  const parsed = searchVideosInputSchema.parse(input)
  const take = normalizeLimit(parsed.take, DEFAULT_SEARCH_PAGE_SIZE)
  const parsedCursor = decodeDiscoverVideoCursor(parsed.cursor)

  const whereClauses: Prisma.Sql[] = [
    buildVideoVisibilityClause(parsed.viewerId ?? null),
    Prisma.sql`v."videoUrl" IS NOT NULL`,
    buildVideoSearchClause(parsed.q),
  ]

  const tagClause = buildVideoTagClause(parsed.tag)
  if (tagClause) {
    whereClauses.push(tagClause)
  }

  if (parsed.sort === "latest" && parsedCursor) {
    whereClauses.push(Prisma.sql`(
      v."createdAt" < ${parsedCursor.createdAt}
      OR (v."createdAt" = ${parsedCursor.createdAt} AND v.id < ${parsedCursor.id})
    )`)
  }

  if (parsed.sort === "top" && parsedCursor && typeof parsedCursor.likeCount === "number") {
    whereClauses.push(Prisma.sql`(
      COALESCE(l.like_count, 0) < ${parsedCursor.likeCount}
      OR (
        COALESCE(l.like_count, 0) = ${parsedCursor.likeCount}
        AND v."createdAt" < ${parsedCursor.createdAt}
      )
      OR (
        COALESCE(l.like_count, 0) = ${parsedCursor.likeCount}
        AND v."createdAt" = ${parsedCursor.createdAt}
        AND v.id < ${parsedCursor.id}
      )
    )`)
  }

  const orderByClause =
    parsed.sort === "top"
      ? Prisma.sql`COALESCE(l.like_count, 0) DESC, v."createdAt" DESC, v.id DESC`
      : Prisma.sql`v."createdAt" DESC, v.id DESC`

  const rows = await prisma.$queryRaw<DiscoverVideoRow[]>(Prisma.sql`
    SELECT
      v.id,
      v.title,
      v."videoUrl",
      v."thumbnailUrl",
      v."createdAt",
      u.id AS "creatorId",
      u.username AS "creatorUsername",
      u.name AS "creatorName",
      u."avatarUrl" AS "creatorAvatarUrl",
      COALESCE(l.like_count, 0)::int AS "likeCount",
      COALESCE(c.comment_count, 0)::int AS "commentCount"
    FROM "Video" v
    INNER JOIN "User" u
      ON u.id = v."userId"
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS like_count
      FROM "Like" l
      WHERE l."videoId" = v.id
    ) l ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS comment_count
      FROM "Comment" c
      WHERE c."videoId" = v.id
    ) c ON TRUE
    WHERE ${Prisma.join(whereClauses, " AND ")}
    ORDER BY ${orderByClause}
    LIMIT ${take + 1}
  `)

  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows
  const lastItem = items.at(-1)

  const nextCursor =
    hasMore && lastItem
      ? encodeDiscoverVideoCursor({
          id: lastItem.id,
          createdAt: lastItem.createdAt,
          ...(parsed.sort === "top" ? { likeCount: lastItem.likeCount } : {}),
        })
      : null

  return {
    items,
    nextCursor,
  } satisfies CursorPage<DiscoverVideoRow>
}

export async function searchUsers(input: SearchUsersInput): Promise<CursorPage<DiscoverUserRow>> {
  const parsed = searchUsersInputSchema.parse(input)
  const take = normalizeLimit(parsed.take, DEFAULT_SEARCH_PAGE_SIZE)
  const parsedCursor = decodeCursor(parsed.cursor)

  const whereClauses: Prisma.Sql[] = [buildUserSearchClause(parsed.q)]

  if (parsedCursor) {
    whereClauses.push(Prisma.sql`(
      u."createdAt" < ${parsedCursor.createdAt}
      OR (u."createdAt" = ${parsedCursor.createdAt} AND u.id < ${parsedCursor.id})
    )`)
  }

  const rows = await prisma.$queryRaw<DiscoverUserRow[]>(Prisma.sql`
    SELECT
      u.id,
      u.username,
      u.name,
      u."avatarUrl" AS "avatarUrl",
      u."createdAt",
      COALESCE(f.follower_count, 0)::int AS "followersCount"
    FROM "User" u
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS follower_count
      FROM "Follow" f
      WHERE f."followingId" = u.id
    ) f ON TRUE
    WHERE ${Prisma.join(whereClauses, " AND ")}
    ORDER BY u."createdAt" DESC, u.id DESC
    LIMIT ${take + 1}
  `)

  return toCursorPage(rows, take)
}

export async function getTrendingVideos({
  take = DEFAULT_DISCOVER_SECTION_SIZE,
  tag,
}: {
  take?: number
  tag?: string | null
} = {}) {
  const limit = normalizeLimit(take, DEFAULT_DISCOVER_SECTION_SIZE)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const videos = await prisma.video.findMany({
    where: {
      visibility: VideoVisibility.PUBLIC,
      status: VideoStatus.READY,
      videoUrl: {
        not: null,
      },
      createdAt: {
        gte: sevenDaysAgo,
      },
      ...(tag
        ? {
            tags: {
              some: {
                tag: {
                  name: {
                    equals: tag,
                    mode: "insensitive",
                  },
                },
              },
            },
          }
        : {}),
    },
    orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: discoverVideoSelect,
  })

  return videos
}

export async function getLatestVideos({
  take = DEFAULT_DISCOVER_SECTION_SIZE,
  tag,
}: {
  take?: number
  tag?: string | null
} = {}) {
  const limit = normalizeLimit(take, DEFAULT_DISCOVER_SECTION_SIZE)

  return prisma.video.findMany({
    where: {
      visibility: VideoVisibility.PUBLIC,
      status: VideoStatus.READY,
      videoUrl: {
        not: null,
      },
      ...(tag
        ? {
            tags: {
              some: {
                tag: {
                  name: {
                    equals: tag,
                    mode: "insensitive",
                  },
                },
              },
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: discoverVideoSelect,
  })
}

export async function getDiscoverTagOptions(limit = 12): Promise<DiscoverTagOption[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 24)

  return prisma.$queryRaw<DiscoverTagOption[]>(Prisma.sql`
    SELECT
      t.id,
      t.name,
      COUNT(*)::int AS "videoCount"
    FROM "Tag" t
    INNER JOIN "VideoTag" vt ON vt."tagId" = t.id
    INNER JOIN "Video" v ON v.id = vt."videoId"
    WHERE v."visibility" = ${VideoVisibility.PUBLIC}
      AND v."status" = ${VideoStatus.READY}
      AND v."videoUrl" IS NOT NULL
    GROUP BY t.id, t.name
    ORDER BY COUNT(*) DESC, t.name ASC
    LIMIT ${safeLimit}
  `)
}
