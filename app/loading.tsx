import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomeLoading() {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-10 w-56" />
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="flex gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="flex gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    </section>
  )
}
