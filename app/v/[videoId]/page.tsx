import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertCircle, Clapperboard, Heart, MessageCircle } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getCurrentUser } from "@/lib/auth-guards"
import { getVideoById } from "@/lib/data/videos"

type VideoPageProps = {
  params: Promise<{
    videoId: string
  }>
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { videoId } = await params
  const viewer = await getCurrentUser()

  const video = await getVideoById(videoId, viewer?.id ?? null)

  if (!video) {
    notFound()
  }

  const createdAtLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(video.createdAt)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card className="overflow-hidden border-border/60">
        {video.canView ? (
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{video.visibility}</Badge>
              <Badge variant="outline">{video.status}</Badge>
            </div>
            <div>
              <CardTitle className="text-2xl">{video.title}</CardTitle>
              <CardDescription>{video.description ?? "No description yet."}</CardDescription>
              <p className="mt-2 text-xs text-muted-foreground">Published {createdAtLabel}</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Link href={`/u/${video.user.username ?? video.user.id}`} className="group flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={video.user.avatarUrl ?? undefined} alt={video.user.name ?? "Creator avatar"} />
                  <AvatarFallback>{video.user.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  <p className="font-medium transition-colors group-hover:text-primary">{video.user.name ?? "Creator"}</p>
                  <p className="text-xs text-muted-foreground">@{video.user.username ?? video.user.id.slice(0, 8)}</p>
                </div>
              </Link>
              <Button disabled variant="outline">
                Follow (Phase 2 read-only)
              </Button>
            </div>
          </CardHeader>
        ) : (
          <CardHeader>
            <CardTitle>Not available</CardTitle>
            <CardDescription>This private video is only available to the owner.</CardDescription>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {video.canView && video.videoUrl ? (
            <div className="aspect-video overflow-hidden rounded-xl border bg-black">
              <video
                controls
                playsInline
                preload="metadata"
                poster={video.thumbnailUrl ?? undefined}
                className="size-full object-contain"
                src={video.videoUrl}
              />
            </div>
          ) : video.canView ? (
            <Empty className="aspect-video border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clapperboard className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Video player placeholder</EmptyTitle>
                <EmptyDescription>Upload completed but no playable URL is available yet.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Empty className="aspect-video border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircle className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Not available</EmptyTitle>
                <EmptyDescription>This private video is only available to the owner.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {video.canView ? (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Heart className="size-4" />
                {video._count.likes} likes
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-4" />
                {video._count.comments} comments
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
