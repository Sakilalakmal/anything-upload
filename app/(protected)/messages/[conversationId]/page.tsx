import { notFound } from "next/navigation"

import { ConversationPageClient } from "@/components/messages/conversation-page-client"
import { requireUser } from "@/lib/auth-guards"
import { getConversation, getMessages } from "@/lib/chat/service"

type ConversationPageProps = {
  params: Promise<{
    conversationId: string
  }>
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const user = await requireUser()
  const { conversationId } = await params

  const conversation = await getConversation(conversationId, user.id)

  if (!conversation) {
    notFound()
  }

  const messagesPage = await getMessages({
    conversationId,
    userId: user.id,
  })

  return (
    <ConversationPageClient
      currentUserId={user.id}
      conversation={conversation}
      initialMessages={messagesPage.items}
      initialNextCursor={messagesPage.nextCursor}
    />
  )
}
