import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth-guards"
import { getFeedPage, serializeFeedPage } from "@/lib/data/feed"

const feedQuerySchema = z.object({
  cursor: z.string().min(1).nullable(),
})

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const viewer = await getCurrentUser()
  const parsedQuery = feedQuerySchema.safeParse({
    cursor: request.nextUrl.searchParams.get("cursor"),
  })

  const page = await getFeedPage({
    cursor: parsedQuery.success ? parsedQuery.data.cursor : null,
    viewerId: viewer?.id ?? null,
  })

  return NextResponse.json(serializeFeedPage(page))
}
