"use client"

import { Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ShareVideoButtonProps = {
  videoId: string
  title: string
  className?: string
  layout?: "inline" | "rail"
}

export function ShareVideoButton({
  videoId,
  title,
  className,
  layout = "inline",
}: ShareVideoButtonProps) {
  const [label, setLabel] = useState("Share")

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/v/${videoId}`

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          url: shareUrl,
        })
        return
      }

      await navigator.clipboard.writeText(shareUrl)
      setLabel("Copied")
      window.setTimeout(() => setLabel("Share"), 1800)
      toast.success("Video link copied.")
    } catch {
      toast.error("Could not share this video.")
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => void handleShare()}
      className={cn(
        layout === "rail"
          ? "group h-auto min-w-0 flex-col gap-1 rounded-none p-0 hover:bg-transparent"
          : "h-8 rounded-full px-2.5 transition-transform hover:-translate-y-0.5",
        className
      )}
      aria-label="Share video"
    >
      {layout === "rail" ? (
        <>
          <span className="flex size-12 items-center justify-center rounded-full bg-[#f1f1f2] text-foreground transition-transform duration-200 group-hover:scale-105">
            <Share2 className="size-5" />
          </span>
          <span className="text-[13px] font-semibold text-foreground">{label}</span>
        </>
      ) : (
        <>
          <Share2 className="size-4" />
          {label}
        </>
      )}
    </Button>
  )
}
