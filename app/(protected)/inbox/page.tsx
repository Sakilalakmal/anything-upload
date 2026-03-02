import { InboxPageClient } from "@/components/notifications/inbox-page-client"
import { requireUser } from "@/lib/auth-guards"
import { getNotifications, getUnreadCount } from "@/lib/data/notifications"
import { inboxTabSchema } from "@/lib/validations/notifications"

type InboxPageProps = {
  searchParams: Promise<{
    tab?: string
  }>
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const user = await requireUser()
  const resolvedSearchParams = await searchParams
  const tab = inboxTabSchema.catch("all").parse(resolvedSearchParams.tab)

  const [initialPage, unreadCount] = await Promise.all([
    getNotifications({
      recipientId: user.id,
      filterUnread: tab === "unread",
    }),
    getUnreadCount(user.id),
  ])

  return <InboxPageClient initialTab={tab} initialUnreadCount={unreadCount} initialPage={initialPage} />
}
