import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DiscoverLoading() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <Card className="border-border/60">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-11 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <Skeleton className="aspect-video rounded-none" />
            <CardContent className="space-y-2 p-3">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-8/12" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
