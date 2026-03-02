"use client"

import Link from "next/link"
import { Music4 } from "lucide-react"

import { CommentsSheet } from "@/components/social/comments-sheet"
import { FollowButton } from "@/components/social/follow-button"
import { LikeButton } from "@/components/social/like-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { FeedVideoItem } from "@/lib/data/feed-types"
import { VideoPlayer } from "@/components/video/video-player"
import { ShareVideoButton } from "@/components/video/share-video-button"

type VideoCardProps = {
  item: FeedVideoItem
  isAuthenticated: boolean
  viewerUserId: string | null
}

export function VideoCard({ item, isAuthenticated, viewerUserId }: VideoCardProps) {
  const creatorLabel = item.creator.name ?? item.creator.username ?? "Creator"
  const creatorHandle = item.creator.username ?? item.creator.id.slice(0, 8)
  const creatorPath = `/u/${item.creator.username ?? item.creator.id}`
  const isOwnVideo = viewerUserId === item.creator.id

  return (
    <article className="mx-auto w-full max-w-[46rem] border-b border-border/70 pb-8">
      <div className="flex items-start gap-3 sm:gap-4">
        <Link href={creatorPath} className="shrink-0">
          <Avatar className="size-12 ring-1 ring-black/10 transition-all hover:ring-black/20 sm:size-14">
            <AvatarImage src={item.creator.avatarUrl ?? undefined} alt={`${creatorLabel} avatar`} />
            <AvatarFallback>{creatorLabel.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-none">
                <Link href={creatorPath} className="truncate font-semibold text-foreground transition-colors hover:text-[#fe2c55]">
                  {creatorLabel}
                </Link>
                <span className="truncate text-sm text-muted-foreground">@{creatorHandle}</span>
                <span className="text-xs text-muted-foreground">{item.createdAtRelative}</span>
              </div>
              <Link href={`/v/${item.id}`} className="block max-w-2xl text-[15px] leading-6 text-foreground">
                {item.title}
              </Link>
              <div className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-foreground">
                <Music4 className="size-4 shrink-0" />
                <span className="truncate">original sound - {creatorLabel}</span>
              </div>
            </div>

            {!isOwnVideo ? (
              <FollowButton
                targetUserId={item.creator.id}
                profilePath={creatorPath}
                isAuthenticated={isAuthenticated}
                initialFollowing={item.creator.viewerFollowing}
                initialFollowerCount={item.creator.followerCount}
                showCount={false}
                className="h-10 min-w-28 rounded-xl border-[#fe2c55]/35 text-[#fe2c55] hover:border-[#fe2c55] hover:bg-[#fff0f3] hover:text-[#fe2c55]"
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <VideoPlayer
              src={item.videoUrl}
              poster={item.thumbnailUrl}
              title={item.title}
              className="mx-0 max-w-[22rem] rounded-[24px] border-black/10 shadow-none"
            />

            <div className="flex items-center gap-3 sm:mb-2 sm:flex-col sm:items-center sm:gap-4">
              <LikeButton
                videoId={item.id}
                initialLiked={item.viewerLiked}
                initialLikeCount={item.likeCount}
                isAuthenticated={isAuthenticated}
                layout="rail"
              />
              <CommentsSheet
                videoId={item.id}
                title={item.title}
                initialCommentCount={item.commentCount}
                isAuthenticated={isAuthenticated}
                layout="rail"
              />
              <ShareVideoButton videoId={item.id} title={item.title} layout="rail" />
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
