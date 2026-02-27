"use client"

import Link from "next/link"

import { CommentsSheet } from "@/components/social/comments-sheet"
import { LikeButton } from "@/components/social/like-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { FeedVideoItem } from "@/lib/data/feed-types"
import { VideoPlayer } from "@/components/video/video-player"

type VideoCardProps = {
  item: FeedVideoItem
  isAuthenticated: boolean
}

export function VideoCard({ item, isAuthenticated }: VideoCardProps) {
  return (
    <Card className="mx-auto w-full max-w-[34rem] gap-4 overflow-hidden border-border/70 py-0 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <CardHeader className="space-y-3 px-3.5 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/u/${item.creator.username ?? item.creator.id}`} className="group flex min-w-0 items-center gap-3">
            <Avatar size="sm" className="ring-1 ring-border transition-all group-hover:ring-primary/40">
              <AvatarImage src={item.creator.avatarUrl ?? undefined} alt={item.creator.name ?? "Creator avatar"} />
              <AvatarFallback>{item.creator.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium transition-colors group-hover:text-primary">{item.creator.name ?? "Creator"}</p>
              <p className="truncate text-xs text-muted-foreground">@{item.creator.username ?? item.creator.id.slice(0, 8)}</p>
            </div>
          </Link>
          <Badge variant="outline" className="shrink-0">
            {item.createdAtRelative}
          </Badge>
        </div>
        <div className="space-y-1">
          <Link
            href={`/v/${item.id}`}
            className="line-clamp-2 text-sm font-semibold tracking-tight transition-colors hover:text-primary"
          >
            {item.title}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-3.5 pb-3.5">
        <VideoPlayer src={item.videoUrl} poster={item.thumbnailUrl} title={item.title} />
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <LikeButton
              videoId={item.id}
              initialLiked={item.viewerLiked}
              initialLikeCount={item.likeCount}
              isAuthenticated={isAuthenticated}
            />
            <CommentsSheet
              videoId={item.id}
              title={item.title}
              initialCommentCount={item.commentCount}
              isAuthenticated={isAuthenticated}
            />
          </div>
          <time dateTime={item.createdAt}>Posted {item.createdAtRelative}</time>
        </div>
      </CardContent>
    </Card>
  )
}
