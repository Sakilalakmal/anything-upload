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
}

export function CommentsSheet({ videoId, title, initialCommentCount, isAuthenticated }: CommentsSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(initialCommentCount)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full px-2.5 transition-transform hover:-translate-y-0.5">
          <MessageCircle className="size-4" />
          {commentCount}
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
