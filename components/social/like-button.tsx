"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { toggleLikeAction } from "@/app/actions/social"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LikeButtonProps = {
  videoId: string
  initialLiked: boolean
  initialLikeCount: number
  isAuthenticated: boolean
  className?: string
}

export function LikeButton({
  videoId,
  initialLiked,
  initialLikeCount,
  isAuthenticated,
  className,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    if (!isAuthenticated || isPending) {
      return
    }

    const previousState = {
      liked,
      likeCount,
    }

    const optimisticLiked = !liked
    setLiked(optimisticLiked)
    setLikeCount((prev) => Math.max(0, prev + (optimisticLiked ? 1 : -1)))

    startTransition(async () => {
      const result = await toggleLikeAction({ videoId })

      if (!result.success) {
        setLiked(previousState.liked)
        setLikeCount(previousState.likeCount)
        toast.error(result.error)
        return
      }

      setLiked(result.liked)
      setLikeCount(result.likeCount)
    })
  }

  if (!isAuthenticated) {
    return (
      <Button asChild type="button" size="sm" variant="ghost" className={cn("h-8 rounded-full px-2.5", className)}>
        <Link href="/sign-in" aria-label="Sign in to like">
          <Heart className="size-4" />
          {likeCount}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={liked ? "secondary" : "ghost"}
      disabled={isPending}
      className={cn(
        "h-8 rounded-full px-2.5 transition-all duration-200 hover:-translate-y-0.5",
        liked && "text-rose-600",
        className
      )}
      onClick={handleToggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike video" : "Like video"}
    >
      <Heart className={cn("size-4", liked && "fill-current")} />
      {likeCount}
    </Button>
  )
}
