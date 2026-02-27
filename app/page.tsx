import Link from "next/link"
import { Clapperboard, Heart, MessageCircle } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getCurrentUser } from "@/lib/auth-guards"
import { fetchFeedPage } from "@/lib/data/videos"

export default async function HomePage() {
  const user = await getCurrentUser()
  const feed = await fetchFeedPage({ limit: 12 })

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-2">
        <Badge variant="outline">Home feed</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Discover videos</h1>
        <p className="text-sm text-muted-foreground">Phase 2 fetches real feed records from Postgres with cursor pagination.</p>
      </div>

      {feed.items.length ? (
        <div className="space-y-4">
          {feed.items.map((video) => (
            <Card key={video.id} className="transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={video.user.avatarUrl ?? undefined} alt={video.user.name ?? "Creator avatar"} />
                      <AvatarFallback>{video.user.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <p className="font-medium">{video.user.name ?? "Creator"}</p>
                      <p className="text-xs text-muted-foreground">@{video.user.username ?? video.user.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="transition-transform hover:-translate-y-0.5">
                    <Link href={`/v/${video.id}`}>Open</Link>
                  </Button>
                </div>
                <div>
                  <CardTitle className="text-xl">{video.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {video.description ?? "No description yet. Upload support lands in Phase 3."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3.5" />
                    {video._count.likes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="size-3.5" />
                    {video._count.comments}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <Empty className="border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clapperboard className="size-5" />
                </EmptyMedia>
                <EmptyTitle>No feed videos yet</EmptyTitle>
                <EmptyDescription>
                  Create metadata records in Phase 2 or upload real files in Phase 3 to populate this feed.
                </EmptyDescription>
              </EmptyHeader>
              <div className="flex flex-wrap justify-center gap-2">
                {user ? (
                  <Button asChild className="transition-transform hover:-translate-y-0.5">
                    <Link href="/upload">Go to upload placeholder</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild className="transition-transform hover:-translate-y-0.5">
                      <Link href="/sign-up">Create account</Link>
                    </Button>
                    <Button asChild variant="outline" className="transition-transform hover:-translate-y-0.5">
                      <Link href="/sign-in">Sign in</Link>
                    </Button>
                  </>
                )}
              </div>
            </Empty>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
