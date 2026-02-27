import Link from "next/link"
import { Clapperboard } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FeedList } from "@/components/feed/feed-list"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getCurrentUser } from "@/lib/auth-guards"
import { getFeedPage, serializeFeedPage } from "@/lib/data/feed"

export default async function HomePage() {
  const user = await getCurrentUser()
  const rawFeedPage = await getFeedPage({
    viewerId: user?.id ?? null,
  })
  const feed = serializeFeedPage(rawFeedPage)

  return (
    <section className="mx-auto w-full max-w-[34rem] space-y-6">
      <div className="space-y-2">
        <Badge variant="outline">For You</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Home feed</h1>
        <p className="text-sm text-muted-foreground">Newest public videos, auto-playing as you scroll.</p>
      </div>

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
                <EmptyDescription>Publish a public video to start the Home feed.</EmptyDescription>
              </EmptyHeader>
              <div className="flex flex-wrap justify-center gap-2">
                {user ? (
                  <Button asChild className="transition-transform hover:-translate-y-0.5">
                    <Link href="/upload">Upload your first video</Link>
                  </Button>
                ) : (
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
