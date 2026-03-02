import Link from "next/link"
import { AlertCircle, Clapperboard } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FeedList } from "@/components/feed/feed-list"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getCurrentUser } from "@/lib/auth-guards"
import type { FeedPagePayload } from "@/lib/data/feed-types"
import { getFeedPage, serializeFeedPage } from "@/lib/data/feed"
import { isPrismaDatabaseConnectivityError } from "@/lib/prisma-errors"

const EMPTY_FEED: FeedPagePayload = {
  items: [],
  nextCursor: null,
}

export default async function HomePage() {
  const user = await getCurrentUser()
  let feed = EMPTY_FEED
  let feedUnavailable = false

  try {
    const rawFeedPage = await getFeedPage({
      viewerId: user?.id ?? null,
    })

    feed = serializeFeedPage(rawFeedPage)
  } catch (error) {
    if (isPrismaDatabaseConnectivityError(error)) {
      feedUnavailable = true
    } else {
      throw error
    }
  }

  return (
    <section className="mx-auto w-full max-w-[34rem] space-y-6">
      <div className="space-y-2">
        <Badge variant="outline">For You</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Home feed</h1>
        <p className="text-sm text-muted-foreground">Newest public videos, auto-playing as you scroll.</p>
      </div>

      {feedUnavailable ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Feed temporarily unavailable</AlertTitle>
          <AlertDescription>
            The app could not reach the database, so public videos and signed-in state are unavailable right now.
          </AlertDescription>
        </Alert>
      ) : null}

      {feed.items.length ? (
        <FeedList initialItems={feed.items} initialNextCursor={feed.nextCursor} isAuthenticated={Boolean(user)} />
      ) : (
        <Card>
          <CardContent className="p-6">
            <Empty className="border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clapperboard className="size-5" />
                </EmptyMedia>
                <EmptyTitle>No videos in the feed yet</EmptyTitle>
                <EmptyDescription>
                  {feedUnavailable
                    ? "Reconnect the database to load the public feed."
                    : "Publish a public video to start the Home feed."}
                </EmptyDescription>
              </EmptyHeader>
              <div className="flex flex-wrap justify-center gap-2">
                {user ? (
                  <Button asChild className="transition-transform hover:-translate-y-0.5">
                    <Link href="/upload">Upload your first video</Link>
                  </Button>
                ) : feedUnavailable ? null : (
                  <Button asChild className="transition-transform hover:-translate-y-0.5">
                    <Link href="/sign-in">Sign in to upload</Link>
                  </Button>
                )}
              </div>
            </Empty>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
