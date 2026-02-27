import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomeLoading() {
  return (
    <section className="mx-auto w-full max-w-[34rem] space-y-5">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-10 w-44" />
      <FeedLoadingCard />
      <FeedLoadingCard />
    </section>
  )
}

function FeedLoadingCard() {
  return (
    <Card className="mx-auto w-full max-w-[34rem] gap-4 overflow-hidden py-0">
      <CardHeader className="space-y-3 px-3.5 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-10/12" />
      </CardHeader>
      <CardContent className="space-y-3 px-3.5 pb-3.5">
        <div className="overflow-hidden rounded-2xl border border-border/70">
          <div className="mx-auto w-full max-w-[23rem]">
            <div className="relative h-0 pb-[177.78%]">
              <Skeleton className="absolute inset-0 rounded-none" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>
    </Card>
  )
}
