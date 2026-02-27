"use client"

import Link from "next/link"
import { Loader2, MessageCircle } from "lucide-react"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { createCommentAction } from "@/app/actions/social"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { CommentItem, CommentsPagePayload } from "@/lib/data/social-types"
import { cn } from "@/lib/utils"

type CommentsPanelProps = {
  videoId: string
  initialCommentCount: number
  isAuthenticated: boolean
  enabled?: boolean
  className?: string
  onCommentCountChange?: (count: number) => void
}

export function CommentsPanel({
  videoId,
  initialCommentCount,
  isAuthenticated,
  enabled = true,
  className,
  onCommentCountChange,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [commentInput, setCommentInput] = useState("")
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingInitial, setIsLoadingInitial] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSubmitting, startSubmitting] = useTransition()

  const hasLoadedRef = useRef(false)

  const updateCommentCount = useCallback(
    (nextCount: number) => {
      setCommentCount(nextCount)
      onCommentCountChange?.(nextCount)
    },
    [onCommentCountChange]
  )

  const fetchComments = useCallback(
    async (cursor: string | null, mode: "initial" | "more") => {
      if (mode === "initial") {
        setIsLoadingInitial(true)
      } else {
        setIsLoadingMore(true)
      }

      setError(null)

      try {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
        const response = await fetch(`/api/videos/${videoId}/comments${query}`, {
          method: "GET",
          cache: "no-store",
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error || "Unable to load comments.")
        }

        const data = (await response.json()) as CommentsPagePayload

        setComments((previousComments) => {
          if (mode === "initial") {
            return data.items
          }

          const seenIds = new Set(previousComments.map((comment) => comment.id))
          const uniqueItems = data.items.filter((comment) => !seenIds.has(comment.id))
          return [...previousComments, ...uniqueItems]
        })
        setNextCursor(data.nextCursor)
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load comments.")
      } finally {
        if (mode === "initial") {
          hasLoadedRef.current = true
          setIsLoadingInitial(false)
        } else {
          setIsLoadingMore(false)
        }
      }
    },
    [videoId]
  )

  useEffect(() => {
    if (!enabled || hasLoadedRef.current) {
      return
    }

    void fetchComments(null, "initial")
  }, [enabled, fetchComments])

  const handleCommentSubmit = () => {
    const content = commentInput.trim()

    if (!content) {
      return
    }

    startSubmitting(async () => {
      const result = await createCommentAction({
        videoId,
        content,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      setComments((previousComments) => [result.comment, ...previousComments])
      setCommentInput("")
      updateCommentCount(result.commentCount)
    })
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <MessageCircle className="size-4" />
          Comments
        </p>
        <p className="text-xs text-muted-foreground">{commentCount}</p>
      </div>

      {isAuthenticated ? (
        <div className="space-y-2">
          <Textarea
            value={commentInput}
            onChange={(event) => setCommentInput(event.target.value)}
            placeholder="Add a comment..."
            maxLength={500}
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{commentInput.length}/500</p>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting || commentInput.trim().length === 0}
              onClick={handleCommentSubmit}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Posting...
                </span>
              ) : (
                "Post comment"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href="/sign-in">Sign in to comment</Link>
        </Button>
      )}

      {isLoadingInitial ? (
        <div className="space-y-3">
          <CommentSkeleton />
          <CommentSkeleton />
          <CommentSkeleton />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void fetchComments(null, "initial")}>
            Retry
          </Button>
        </div>
      ) : comments.length ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border bg-card p-3 transition-colors hover:bg-muted/20">
              <div className="flex items-start gap-3">
                <Avatar size="sm">
                  <AvatarImage src={comment.user.avatarUrl ?? undefined} alt={comment.user.name ?? "User avatar"} />
                  <AvatarFallback>{comment.user.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-medium">
                    {comment.user.name ?? "User"}{" "}
                    <span className="text-muted-foreground">@{comment.user.username ?? comment.user.id.slice(0, 8)}</span>
                  </p>
                  <p className="break-words text-sm">{comment.content}</p>
                  <p className="text-xs text-muted-foreground">{comment.createdAtRelative}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No comments yet.
        </div>
      )}

      {nextCursor ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isLoadingMore}
          onClick={() => void fetchComments(nextCursor, "more")}
        >
          {isLoadingMore ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Loading...
            </span>
          ) : (
            "Load more comments"
          )}
        </Button>
      ) : null}
    </div>
  )
}

function CommentSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        <Skeleton className="size-6 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}
