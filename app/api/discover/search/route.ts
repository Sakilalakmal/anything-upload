import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth-guards"
import { searchUsers, searchVideos, serializeUserSearchPage, serializeVideoSearchPage } from "@/lib/data/discover"
import { discoverSearchRouteQuerySchema } from "@/lib/validations/discover"

const SEARCH_RATE_LIMIT_WINDOW_MS = 60_000
const SEARCH_RATE_LIMIT_MAX_REQUESTS = 80
const searchRateLimitStore = new Map<string, { count: number; expiresAt: number }>()

export const dynamic = "force-dynamic"

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown"
  }

  return request.headers.get("x-real-ip") ?? "unknown"
}

function enforceSearchRateLimit(request: NextRequest) {
  const now = Date.now()
  const key = getClientIp(request)
  const currentEntry = searchRateLimitStore.get(key)

  if (!currentEntry || currentEntry.expiresAt <= now) {
    searchRateLimitStore.set(key, {
      count: 1,
      expiresAt: now + SEARCH_RATE_LIMIT_WINDOW_MS,
    })
    return true
  }

  if (currentEntry.count >= SEARCH_RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  currentEntry.count += 1
  searchRateLimitStore.set(key, currentEntry)

  if (searchRateLimitStore.size > 10_000) {
    for (const [entryKey, entry] of searchRateLimitStore) {
      if (entry.expiresAt <= now) {
        searchRateLimitStore.delete(entryKey)
      }
    }
  }

  return true
}

export async function GET(request: NextRequest) {
  if (!enforceSearchRateLimit(request)) {
    return NextResponse.json(
      {
        error: "Too many search requests. Please wait a moment.",
      },
      {
        status: 429,
      }
    )
  }

  const parsedQuery = discoverSearchRouteQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q"),
    tab: request.nextUrl.searchParams.get("tab") ?? undefined,
    cursor: request.nextUrl.searchParams.get("cursor"),
    take: request.nextUrl.searchParams.get("take") ?? undefined,
    sort: request.nextUrl.searchParams.get("sort") ?? undefined,
    tag: request.nextUrl.searchParams.get("tag") ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: parsedQuery.error.issues[0]?.message ?? "Invalid search query.",
      },
      {
        status: 400,
      }
    )
  }

  const viewer = await getCurrentUser()
  const query = parsedQuery.data

  if (query.tab === "users") {
    const page = await searchUsers({
      q: query.q,
      cursor: query.cursor,
      take: query.take,
    })

    return NextResponse.json({
      tab: "users" as const,
      ...serializeUserSearchPage(page),
    })
  }

  const page = await searchVideos({
    q: query.q,
    cursor: query.cursor,
    take: query.take,
    sort: query.sort,
    tag: query.tag,
    viewerId: viewer?.id ?? null,
  })

  return NextResponse.json({
    tab: "videos" as const,
    ...serializeVideoSearchPage(page),
  })
}
