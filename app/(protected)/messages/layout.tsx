import { MessagesShell } from "@/components/messages/messages-shell"
import { requireUser } from "@/lib/auth-guards"
import { getInboxConversations } from "@/lib/data/chat"

export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  const conversations = await getInboxConversations(user.id)

  return <MessagesShell initialConversations={conversations}>{children}</MessagesShell>
}
