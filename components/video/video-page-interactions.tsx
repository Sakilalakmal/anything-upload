"use client"

import { MessageCircle } from "lucide-react"
import { useState } from "react"

import { CommentsPanel } from "@/components/social/comments-panel"
import { LikeButton } from "@/components/social/like-button"

type VideoPageInteractionsProps = {
  videoId: string
  initialLiked: boolean
  initialLikeCount: number
  initialCommentCount: number
  isAuthenticated: boolean
}

export function VideoPageInteractions({
  videoId,
  initialLiked,
  initialLikeCount,
  initialCommentCount,
  isAuthenticated,
}: VideoPageInteractionsProps) {
  const [commentCount, setCommentCount] = useState(initialCommentCount)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <LikeButton
          videoId={videoId}
          initialLiked={initialLiked}
          initialLikeCount={initialLikeCount}
          isAuthenticated={isAuthenticated}
        />
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="size-4" />
          {commentCount} comments
        </span>
      </div>

      <CommentsPanel
        videoId={videoId}
        initialCommentCount={commentCount}
        isAuthenticated={isAuthenticated}
        onCommentCountChange={setCommentCount}
      />
    </div>
  )
}
