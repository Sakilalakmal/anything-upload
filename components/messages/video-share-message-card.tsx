"use client"

import Link from "next/link"
import { format } from "date-fns"
import { Clapperboard } from "lucide-react"

import type { ChatVideoSharePreview } from "@/lib/chat/types"
import { cn } from "@/lib/utils"

export function VideoShareMessageCard({
  videoId,
  video,
  isOwnMessage,
}: {
  videoId: string
  video: ChatVideoSharePreview | null
  isOwnMessage: boolean
}) {
  if (!video) {
    return (
      <Link
        href={`/v/${videoId}`}
        className="block overflow-hidden rounded-2xl border border-white/15 bg-black/15 text-left transition hover:border-white/25"
      >
        <div className="grid aspect-[16/9] place-items-center bg-white/8">
          <Clapperboard className="size-8 text-white/80" />
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-semibold">Shared video</p>
        </div>
      </Link>
    )
  }

  const creatorLabel = video.creator.name ?? video.creator.username ?? "Creator"

  return (
    <Link
      href={`/v/${video.id}`}
      className={cn(
        "block overflow-hidden rounded-[1.35rem] border text-left transition-transform duration-200 hover:-translate-y-0.5",
        isOwnMessage ? "border-white/20 bg-white/8 text-white" : "border-border/60 bg-white text-foreground"
      )}
    >
      <div className={cn("grid aspect-[16/9] place-items-center overflow-hidden", isOwnMessage ? "bg-black/20" : "bg-muted/40")}>
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt={video.title} className="size-full object-cover" />
        ) : (
          <Clapperboard className={cn("size-10", isOwnMessage ? "text-white/85" : "text-muted-foreground")} />
        )}
      </div>
      <div className="space-y-3 px-4 py-3">
        <div>
          <p className="line-clamp-2 text-sm font-semibold">{video.title}</p>
          <p className={cn("mt-1 text-xs", isOwnMessage ? "text-white/75" : "text-muted-foreground")}>
            @{video.creator.username ?? video.creator.id.slice(0, 8)} by {creatorLabel}
          </p>
          <p className={cn("mt-1 text-[11px]", isOwnMessage ? "text-white/65" : "text-muted-foreground")}>
            {format(new Date(video.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium",
            isOwnMessage ? "border-white/20 bg-white text-[#0f766e]" : "border-border/60 bg-white text-foreground"
          )}
        >
          Open video
        </span>
      </div>
    </Link>
  )
}
