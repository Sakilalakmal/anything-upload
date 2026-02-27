"use client"

import Link from "next/link"
import { UserPlus } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { toggleFollowAction } from "@/app/actions/social"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FollowButtonProps = {
  targetUserId: string
  profilePath: string
  isAuthenticated: boolean
  initialFollowing: boolean
  initialFollowerCount: number
  className?: string
}

export function FollowButton({
  targetUserId,
  profilePath,
  isAuthenticated,
  initialFollowing,
  initialFollowerCount,
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    if (!isAuthenticated || isPending) {
      return
    }

    const previousState = {
      following,
      followerCount,
    }

    const optimisticFollowing = !following
    setFollowing(optimisticFollowing)
    setFollowerCount((prev) => Math.max(0, prev + (optimisticFollowing ? 1 : -1)))

    startTransition(async () => {
      const result = await toggleFollowAction({
        targetUserId,
        profilePath,
      })

      if (!result.success) {
        setFollowing(previousState.following)
        setFollowerCount(previousState.followerCount)
        toast.error(result.error)
        return
      }

      setFollowing(result.following)
      setFollowerCount(result.followerCount)
    })
  }

  if (!isAuthenticated) {
    return (
      <Button asChild variant="outline" className={cn(className)}>
        <Link href="/sign-in">Sign in to follow</Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={following ? "secondary" : "outline"}
      onClick={handleToggle}
      disabled={isPending}
      className={cn("transition-transform hover:-translate-y-0.5", className)}
      aria-pressed={following}
      aria-label={following ? "Unfollow creator" : "Follow creator"}
    >
      {!following ? <UserPlus className="size-4" /> : null}
      {following ? "Following" : "Follow"}
      <span className="text-xs text-muted-foreground">{followerCount}</span>
    </Button>
  )
}
