"use client"

import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { VideoCard } from "@/components/video/video-card"
import type { FeedPagePayload, FeedVideoItem } from "@/lib/data/feed-types"

type FeedListProps = {
  initialItems: FeedVideoItem[]
  initialNextCursor: string | null
  isAuthenticated: boolean
}

const FETCH_DEBOUNCE_MS = 250

export function FeedList({ initialItems, initialNextCursor, isAuthenticated }: FeedListProps) {
  const [items, setItems] = useState(initialItems)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const inFlightRef = useRef(false)
  const lastFetchAtRef = useRef(0)

  const loadMore = useCallback(async () => {
    if (!nextCursor || inFlightRef.current) {
      return
    }

    const now = Date.now()
    if (now - lastFetchAtRef.current < FETCH_DEBOUNCE_MS) {
      return
    }

    lastFetchAtRef.current = now
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/feed?cursor=${encodeURIComponent(nextCursor)}`, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Unable to load more videos.")
      }

      const data = (await response.json()) as FeedPagePayload
      setItems((previousItems) => {
        const seenIds = new Set(previousItems.map((video) => video.id))
        const uniqueNextItems = data.items.filter((video) => !seenIds.has(video.id))
        return [...previousItems, ...uniqueNextItems]
      })
      setNextCursor(data.nextCursor)
    } catch {
      setError("Could not load more videos. Try again.")
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [nextCursor])

  useEffect(() => {
    const sentinelElement = sentinelRef.current

    if (!sentinelElement || !nextCursor) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          void loadMore()
        }
      },
      {
        rootMargin: "600px 0px",
      }
    )

    observer.observe(sentinelElement)

    return () => {
      observer.disconnect()
    }
  }, [loadMore, nextCursor])

  return (
    <div className="space-y-5">
      {items.map((item) => (
        <VideoCard key={item.id} item={item} isAuthenticated={isAuthenticated} />
      ))}

      {isLoading ? (
        <div className="space-y-5">
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void loadMore()}>
            Retry
          </Button>
        </div>
      ) : null}

      {nextCursor ? (
        <div ref={sentinelRef} aria-hidden className="flex h-10 items-center justify-center">
          {!isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>
      ) : (
        <p className="py-2 text-center text-xs text-muted-foreground">You&apos;ve reached the end of the feed.</p>
      )}
    </div>
  )
}

function FeedCardSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-[34rem] gap-4 overflow-hidden py-0">
      <CardHeader className="space-y-3 px-3.5 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-11/12" />
      </CardHeader>
      <CardContent className="space-y-3 px-3.5 pb-3.5">
        <div className="overflow-hidden rounded-2xl border border-border/70">
          <div className="mx-auto w-full max-w-[23rem]">
            <div className="relative h-0 pb-[177.78%]">
              <Skeleton className="absolute inset-0 rounded-none" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>
    </Card>
  )
}
