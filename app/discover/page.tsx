import { DiscoverPageClient } from "@/components/discover/discover-page-client"
import type { DiscoverUserPagePayload, DiscoverVideoPagePayload } from "@/lib/data/discover-types"
import { getCurrentUser } from "@/lib/auth-guards"
import {
  getDiscoverTagOptions,
  getLatestVideos,
  getTrendingVideos,
  searchUsers,
  searchVideos,
  serializeDiscoverVideoList,
  serializeUserSearchPage,
  serializeVideoSearchPage,
} from "@/lib/data/discover"
import { discoverPageQuerySchema } from "@/lib/validations/discover"

type DiscoverPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

const EMPTY_VIDEO_PAGE: DiscoverVideoPagePayload = {
  items: [],
  nextCursor: null,
}

const EMPTY_USER_PAGE: DiscoverUserPagePayload = {
  items: [],
  nextCursor: null,
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const rawSearchParams = await searchParams
  const parsedQuery = discoverPageQuerySchema.safeParse({
    q: firstValue(rawSearchParams.q),
    tab: firstValue(rawSearchParams.tab),
    sort: firstValue(rawSearchParams.sort),
    tag: firstValue(rawSearchParams.tag),
  })

  const query = parsedQuery.success
    ? parsedQuery.data
    : {
        q: "",
        tab: "videos" as const,
        sort: "latest" as const,
        tag: null,
      }

  const viewer = await getCurrentUser()
  const hasQuery = Boolean(query.q)

  const [tags, trendingVideos, latestVideos, initialVideoPage, initialUserPage] = await Promise.all([
    getDiscoverTagOptions(),
    hasQuery
      ? Promise.resolve([])
      : getTrendingVideos({
          tag: query.tag,
        }).then(serializeDiscoverVideoList),
    hasQuery
      ? Promise.resolve([])
      : getLatestVideos({
          tag: query.tag,
        }).then(serializeDiscoverVideoList),
    hasQuery && query.tab === "videos"
      ? searchVideos({
          q: query.q,
          sort: query.sort,
          tag: query.tag,
          viewerId: viewer?.id ?? null,
        }).then(serializeVideoSearchPage)
      : Promise.resolve(EMPTY_VIDEO_PAGE),
    hasQuery && query.tab === "users"
      ? searchUsers({
          q: query.q,
        }).then(serializeUserSearchPage)
      : Promise.resolve(EMPTY_USER_PAGE),
  ])

  return (
    <section className="mx-auto w-full max-w-5xl">
      <DiscoverPageClient
        key={`${query.q}|${query.tab}|${query.sort}|${query.tag ?? "all"}`}
        initialQuery={query.q}
        initialTab={query.tab}
        initialSort={query.sort}
        initialTag={query.tag}
        tags={tags}
        trendingVideos={trendingVideos}
        latestVideos={latestVideos}
        initialVideoPage={initialVideoPage}
        initialUserPage={initialUserPage}
      />
    </section>
  )
}
