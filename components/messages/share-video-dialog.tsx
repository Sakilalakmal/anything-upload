"use client"

import { useEffect, useState } from "react"
import { Clapperboard, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { ChatVideoSharePreview } from "@/lib/chat/types"
import { parseVideoIdFromUrl } from "@/lib/chat/validations"
import { cn } from "@/lib/utils"

export type ShareableVideoItem = ChatVideoSharePreview & {
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE"
  status: "PROCESSING" | "READY" | "FAILED"
  isOwner: boolean
}

export function ShareVideoDialog({
  open,
  onOpenChange,
  note,
  onNoteChange,
  selectedVideoId,
  onSelectVideoId,
  manualUrl,
  onManualUrlChange,
  isSubmitting,
  onSubmit,
  onVideosLoaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  note: string
  onNoteChange: (value: string) => void
  selectedVideoId: string | null
  onSelectVideoId: (videoId: string | null) => void
  manualUrl: string
  onManualUrlChange: (value: string) => void
  isSubmitting: boolean
  onSubmit: () => void
  onVideosLoaded: (videos: ShareableVideoItem[]) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [videos, setVideos] = useState<ShareableVideoItem[]>([])
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const run = async () => {
      setIsFetching(true)

      try {
        const response = await fetch(`/api/chat/videos?q=${encodeURIComponent(searchQuery)}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Unable to load videos.")
        }

        const payload = (await response.json()) as {
          items: ShareableVideoItem[]
        }

        if (!cancelled) {
          setVideos(payload.items)
          onVideosLoaded(payload.items)
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          toast.error(error instanceof Error ? error.message : "Unable to load videos.")
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open, onVideosLoaded, searchQuery])

  useEffect(() => {
    if (!open) {
      setSearchQuery("")
    }
  }, [open])

  const parsedVideoId = manualUrl ? parseVideoIdFromUrl(manualUrl) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[1.75rem] border-border/60 p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Share2 className="size-5 text-[#0f766e]" />
            Share a video
          </DialogTitle>
          <DialogDescription>Pick a recent public video or paste a `/v/[id]` link. Add an optional note below.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3">
            <label className="text-sm font-medium">Paste video URL</label>
            <Input
              value={manualUrl}
              onChange={(event) => {
                onManualUrlChange(event.target.value)
                if (event.target.value.trim()) {
                  onSelectVideoId(null)
                }
              }}
              placeholder="https://your-app.com/v/abc123..."
              className="rounded-2xl"
            />
            {manualUrl ? (
              <p className="text-xs text-muted-foreground">
                {parsedVideoId ? `Ready to share /v/${parsedVideoId}` : "Use a valid video URL."}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Or select from recent videos</label>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title"
              className="rounded-2xl"
            />
            <ScrollArea className="h-72 rounded-[1.5rem] border border-border/60 bg-muted/10 p-4">
              <div className="space-y-3">
                {isFetching ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-[1.25rem] border border-border/60 bg-white p-4">
                      <Skeleton className="mb-3 aspect-[16/9] w-full rounded-xl" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                  ))
                ) : videos.length ? (
                  videos.map((video) => {
                    const isSelected = selectedVideoId === video.id
                    const creatorLabel = video.creator.name ?? video.creator.username ?? "Creator"

                    return (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => {
                          onManualUrlChange("")
                          onSelectVideoId(video.id)
                        }}
                        className={cn(
                          "flex w-full flex-col overflow-hidden rounded-[1.25rem] border bg-white text-left transition",
                          isSelected ? "border-[#0f766e] ring-2 ring-[#0f766e]/10" : "border-border/60 hover:border-[#0f766e]/35"
                        )}
                      >
                        <div className="grid aspect-[16/9] place-items-center bg-muted/40">
                          {video.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={video.thumbnailUrl} alt={video.title} className="size-full object-cover" />
                          ) : (
                            <Clapperboard className="size-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="space-y-2 px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{video.visibility}</Badge>
                            <Badge variant={video.status === "READY" ? "secondary" : "outline"}>{video.status}</Badge>
                            {video.isOwner ? <Badge className="bg-[#0f766e] text-white hover:bg-[#0f766e]">Mine</Badge> : null}
                          </div>
                          <p className="line-clamp-2 text-sm font-semibold">{video.title}</p>
                          <p className="text-xs text-muted-foreground">
                            @{video.creator.username ?? video.creator.id.slice(0, 8)} by {creatorLabel}
                          </p>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <Empty className="border-0 bg-transparent py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Clapperboard className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle>No shareable videos found</EmptyTitle>
                      <EmptyDescription>Try another title, or paste a direct video link above.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Optional note</label>
            <Textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Say why you shared this"
              rows={3}
              maxLength={1000}
              className="rounded-[1.35rem]"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-5">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#0f766e] text-white hover:bg-[#0b5f58]"
            onClick={onSubmit}
            disabled={isSubmitting || (!selectedVideoId && !parsedVideoId)}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            Share video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
