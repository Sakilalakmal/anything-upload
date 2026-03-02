"use client"

import { MessageCircle } from "lucide-react"
import { useState } from "react"

import { CommentsPanel } from "@/components/social/comments-panel"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

type CommentsSheetProps = {
  videoId: string
  title: string
  initialCommentCount: number
  isAuthenticated: boolean
  layout?: "pill" | "rail"
}

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

function formatCount(value: number) {
  return compactNumberFormatter.format(value)
}

export function CommentsSheet({
  videoId,
  title,
  initialCommentCount,
  isAuthenticated,
  layout = "pill",
}: CommentsSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(initialCommentCount)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={
            layout === "rail"
              ? "group h-auto min-w-0 flex-col gap-1 rounded-none p-0 hover:bg-transparent"
              : "h-8 rounded-full px-2.5 transition-transform hover:-translate-y-0.5"
          }
        >
          {layout === "rail" ? (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-[#f1f1f2] text-foreground transition-transform duration-200 group-hover:scale-105">
                <MessageCircle className="size-5" />
              </span>
              <span className="text-[13px] font-semibold text-foreground">{formatCount(commentCount)}</span>
            </>
          ) : (
            <>
              <MessageCircle className="size-4" />
              {formatCount(commentCount)}
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b pb-3">
          <SheetTitle className="line-clamp-1">{title}</SheetTitle>
          <SheetDescription>Join the conversation.</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <CommentsPanel
            videoId={videoId}
            initialCommentCount={commentCount}
            isAuthenticated={isAuthenticated}
            enabled={isOpen}
            onCommentCountChange={setCommentCount}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
