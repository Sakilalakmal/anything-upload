import Link from "next/link"
import {
  AlertCircle,
  Cat,
  Clapperboard,
  Compass,
  Drama,
  Gamepad2,
  House,
  Music2,
  Search,
  Shirt,
  Sparkles,
  Tv,
  Utensils,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { FeedList } from "@/components/feed/feed-list"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getCurrentUser } from "@/lib/auth-guards"
import { getDiscoverTagOptions } from "@/lib/data/discover"
import type { FeedPagePayload } from "@/lib/data/feed-types"
import { getFeedPage, serializeFeedPage } from "@/lib/data/feed"
import { getSuggestedCreators } from "@/lib/data/users"
import { isPrismaDatabaseConnectivityError } from "@/lib/prisma-errors"

const EMPTY_FEED: FeedPagePayload = {
  items: [],
  nextCursor: null,
}

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const sidebarNavItems = [
  {
    label: "For You",
    href: "/",
    icon: House,
    accent: true,
  },
  {
    label: "Discover",
    href: "/discover",
    icon: Compass,
  },
  {
    label: "Upload",
    href: "/upload",
    icon: Clapperboard,
  },
]

const topicIconByName = new Map([
  ["comedy", Drama],
  ["gaming", Gamepad2],
  ["food", Utensils],
  ["music", Music2],
  ["animals", Cat],
  ["fashion", Shirt],
])

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value)
}

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export default async function HomePage() {
  const user = await getCurrentUser()
  let feed = EMPTY_FEED
  let topicOptions: Awaited<ReturnType<typeof getDiscoverTagOptions>> = []
  let suggestedCreators: Awaited<ReturnType<typeof getSuggestedCreators>> = []
  let feedUnavailable = false

  try {
    const [rawFeedPage, tags, creators] = await Promise.all([
      getFeedPage({
        viewerId: user?.id ?? null,
      }),
      getDiscoverTagOptions(6),
      getSuggestedCreators({
        viewerId: user?.id ?? null,
        limit: 5,
      }),
    ])

    feed = serializeFeedPage(rawFeedPage)
    topicOptions = tags
    suggestedCreators = creators
  } catch (error) {
    if (isPrismaDatabaseConnectivityError(error)) {
      feedUnavailable = true
    } else {
      throw error
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1160px]">
      <div className="grid gap-10 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <nav className="border-b border-border/80 pb-5">
              <ul className="space-y-1.5">
                {sidebarNavItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[17px] font-semibold transition-colors ${
                          item.accent ? "bg-[#fff1f4] text-[#fe2c55]" : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="size-5" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <section className="space-y-4 border-b border-border/80 pb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground">Popular topics</h2>
              </div>
              <div className="space-y-1.5">
                {topicOptions.length ? (
                  topicOptions.map((topic) => {
                    const Icon = topicIconByName.get(topic.name.toLowerCase()) ?? Tv

                    return (
                      <Link
                        key={topic.id}
                        href={`/discover?tag=${encodeURIComponent(topic.name)}`}
                        className="flex items-center justify-between rounded-2xl px-4 py-3 transition-colors hover:bg-muted"
                      >
                        <span className="flex items-center gap-3 text-[15px] font-medium">
                          <Icon className="size-4 text-foreground" />
                          {toTitleCase(topic.name)}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatCompactNumber(topic.videoCount)}</span>
                      </Link>
                    )
                  })
                ) : (
                  <p className="px-4 text-sm text-muted-foreground">Topics appear after creators tag public videos.</p>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground">Suggested accounts</h2>
              </div>
              <div className="space-y-3">
                {suggestedCreators.length ? (
                  suggestedCreators.map((creator) => {
                    const creatorPath = `/u/${creator.username ?? creator.id}`
                    const creatorName = creator.name ?? creator.username ?? "Creator"

                    return (
                      <Link
                        key={creator.id}
                        href={creatorPath}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted"
                      >
                        <Avatar className="size-11 ring-1 ring-black/10">
                          <AvatarImage src={creator.avatarUrl ?? undefined} alt={`${creatorName} avatar`} />
                          <AvatarFallback>{creatorName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{creatorName}</p>
                          <p className="truncate text-xs text-muted-foreground">@{creator.username ?? creator.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCompactNumber(creator._count.followers)} followers
                          </p>
                        </div>
                      </Link>
                    )
                  })
                ) : (
                  <p className="px-2 text-sm text-muted-foreground">Creator suggestions will show up here once profiles exist.</p>
                )}
              </div>
            </section>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#fe2c55]">For you</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">Clean, fast video browsing.</h1>
              <p className="text-sm text-muted-foreground">A TikTok-style feed shell with focused media, quick actions, and creator discovery.</p>
            </div>
            <Button asChild variant="outline" className="hidden rounded-xl sm:inline-flex">
              <Link href="/discover">Open Discover</Link>
            </Button>
          </div>

          {feedUnavailable ? (
            <Alert className="mb-6 rounded-2xl border-destructive/20 bg-destructive/5">
              <AlertCircle className="size-4" />
              <AlertTitle>Feed temporarily unavailable</AlertTitle>
              <AlertDescription>
                The app could not reach the database, so public videos and signed-in state are unavailable right now.
              </AlertDescription>
            </Alert>
          ) : null}

          {feed.items.length ? (
            <FeedList
              initialItems={feed.items}
              initialNextCursor={feed.nextCursor}
              isAuthenticated={Boolean(user)}
              viewerUserId={user?.id ?? null}
            />
          ) : (
            <div className="rounded-[28px] border border-border/80 bg-white px-5 py-12 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.35)] sm:px-10">
              <Empty className="border-none bg-transparent">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Clapperboard className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No videos in the feed yet</EmptyTitle>
                  <EmptyDescription>
                    {feedUnavailable
                      ? "Reconnect the database to load the public feed."
                      : "Publish a public video to start filling this TikTok-style home feed."}
                  </EmptyDescription>
                </EmptyHeader>
                {user ? (
                  <Button asChild className="rounded-xl bg-[#fe2c55] text-white hover:bg-[#e9294f]">
                    <Link href="/upload">Upload your first video</Link>
                  </Button>
                ) : feedUnavailable ? null : (
                  <Button asChild className="rounded-xl bg-[#fe2c55] text-white hover:bg-[#e9294f]">
                    <Link href="/sign-in">Sign in to upload</Link>
                  </Button>
                )}
              </Empty>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
