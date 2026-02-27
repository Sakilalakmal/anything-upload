import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth-guards"
import { getComments } from "@/lib/data/social"

const commentsQuerySchema = z.object({
  cursor: z.string().min(1).nullable(),
})

export const dynamic = "force-dynamic"

type CommentsRouteProps = {
  params: Promise<{
    videoId: string
  }>
}

export async function GET(request: NextRequest, { params }: CommentsRouteProps) {
  const { videoId } = await params
  const viewer = await getCurrentUser()

  const parsedQuery = commentsQuerySchema.safeParse({
    cursor: request.nextUrl.searchParams.get("cursor"),
  })

  try {
    const comments = await getComments({
      videoId,
      cursor: parsedQuery.success ? parsedQuery.data.cursor : null,
      viewerId: viewer?.id ?? null,
    })

    return NextResponse.json(comments)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load comments."
    const status = message === "Video not found." ? 404 : 403

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    )
  }
}
