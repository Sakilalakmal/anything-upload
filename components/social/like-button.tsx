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
  layout?: "pill" | "rail"
}

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

function formatCount(value: number) {
  return compactNumberFormatter.format(value)
}

export function LikeButton({
  videoId,
  initialLiked,
  initialLikeCount,
  isAuthenticated,
  className,
  layout = "pill",
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
      <Button
        asChild
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          layout === "rail"
            ? "group h-auto min-w-0 flex-col gap-1 rounded-none p-0 hover:bg-transparent"
            : "h-8 rounded-full px-2.5",
          className
        )}
      >
        <Link href="/sign-in" aria-label="Sign in to like">
          {layout === "rail" ? (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-[#f1f1f2] text-foreground transition-transform duration-200 group-hover:scale-105">
                <Heart className="size-5" />
              </span>
              <span className="text-[13px] font-semibold text-foreground">{formatCount(likeCount)}</span>
            </>
          ) : (
            <>
              <Heart className="size-4" />
              {formatCount(likeCount)}
            </>
          )}
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
        layout === "rail"
          ? "group h-auto min-w-0 flex-col gap-1 rounded-none p-0 hover:bg-transparent"
          : "h-8 rounded-full px-2.5 transition-all duration-200 hover:-translate-y-0.5",
        liked && layout !== "rail" && "text-rose-600",
        className
      )}
      onClick={handleToggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike video" : "Like video"}
    >
      {layout === "rail" ? (
        <>
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-full bg-[#f1f1f2] text-foreground transition-transform duration-200 group-hover:scale-105",
              liked && "bg-rose-100 text-rose-600"
            )}
          >
            <Heart className={cn("size-5", liked && "fill-current")} />
          </span>
          <span className="text-[13px] font-semibold text-foreground">{formatCount(likeCount)}</span>
        </>
      ) : (
        <>
          <Heart className={cn("size-4", liked && "fill-current")} />
          {formatCount(likeCount)}
        </>
      )}
    </Button>
  )
}
