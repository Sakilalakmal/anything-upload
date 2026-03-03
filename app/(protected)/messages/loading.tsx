import { ConversationPageSkeleton } from "@/components/messages/conversation-page-client"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function MessagesLoading() {
  return (
    <div className="grid min-h-[calc(100vh-8.5rem)] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="hidden overflow-hidden border-border/70 lg:flex lg:flex-col">
        <div className="border-b px-5 py-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-3 h-8 w-36" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-5 py-4">
              <Skeleton className="size-12 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <ConversationPageSkeleton />
    </div>
  )
}
