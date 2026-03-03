import { redirect } from "next/navigation"
import { MessageCircleMore } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { requireUser } from "@/lib/auth-guards"
import { createOrGetConversation } from "@/lib/data/chat"

type MessagesIndexPageProps = {
  searchParams: Promise<{
    user?: string
  }>
}

export default async function MessagesIndexPage({ searchParams }: MessagesIndexPageProps) {
  const user = await requireUser()
  const { user: otherUserId } = await searchParams

  if (otherUserId && otherUserId !== user.id) {
    const conversation = await createOrGetConversation(otherUserId)
    redirect(`/messages/${conversation.id}`)
  }

  return (
    <Card className="hidden min-h-[calc(100vh-8.5rem)] border-border/70 bg-[linear-gradient(135deg,rgba(13,148,136,0.1),rgba(255,255,255,0.96)_45%)] lg:flex lg:items-center lg:justify-center">
      <Empty className="max-w-md border-0 bg-transparent">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageCircleMore className="size-5" />
          </EmptyMedia>
          <EmptyTitle>Select a conversation</EmptyTitle>
          <EmptyDescription>
            Your inbox stays live here. Choose a thread on the left, or open a creator profile to start a new DM.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Card>
  )
}
