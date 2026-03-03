"use client"

import { SmilePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CHAT_REACTION_EMOJIS } from "@/lib/chat/validations"

export function MessageReactionPicker({
  onSelect,
  align,
}: {
  onSelect: (emoji: (typeof CHAT_REACTION_EMOJIS)[number]) => void
  align: "start" | "end"
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-8 rounded-full border border-border/60 bg-white/95 text-muted-foreground opacity-100 shadow-sm transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Add reaction"
        >
          <SmilePlus className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={10}
        className="w-auto rounded-full border-border/60 bg-white/98 p-1 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.55)]"
      >
        <div className="flex items-center gap-1">
          {CHAT_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="grid size-9 place-items-center rounded-full text-lg transition-transform hover:-translate-y-0.5 hover:bg-accent"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
