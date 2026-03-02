import { Skeleton } from "@/components/ui/skeleton"

export default function InboxLoading() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="space-y-5 border-b px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-start gap-4 px-6 py-4">
              <Skeleton className="size-8 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-7/12" />
                <Skeleton className="h-4 w-5/12" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="ml-auto size-2.5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  )
}
