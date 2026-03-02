"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Loader2, Search, Sparkles, UserRound, Video, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  DiscoverTab,
  DiscoverTagOption,
  DiscoverUserItem,
  DiscoverUserPagePayload,
  DiscoverVideoItem,
  DiscoverVideoPagePayload,
  DiscoverVideoSort,
} from "@/lib/data/discover-types"

type DiscoverPageClientProps = {
  initialQuery: string
  initialTab: DiscoverTab
  initialSort: DiscoverVideoSort
  initialTag: string | null
  tags: DiscoverTagOption[]
  trendingVideos: DiscoverVideoItem[]
  latestVideos: DiscoverVideoItem[]
  initialVideoPage: DiscoverVideoPagePayload | null
  initialUserPage: DiscoverUserPagePayload | null
}

type VideoSearchResponse = {
  tab: "videos"
} & DiscoverVideoPagePayload

type UserSearchResponse = {
  tab: "users"
} & DiscoverUserPagePayload

const SEARCH_DEBOUNCE_MS = 320
const RECENT_SEARCHES_KEY = "anything:recent-searches"
const MAX_RECENT_SEARCHES = 6

const EMPTY_VIDEO_PAGE: DiscoverVideoPagePayload = {
  items: [],
  nextCursor: null,
}

const EMPTY_USER_PAGE: DiscoverUserPagePayload = {
  items: [],
  nextCursor: null,
}

function createDiscoverHref({
  pathname,
  q,
  tab,
  sort,
  tag,
}: {
  pathname: string
  q: string
  tab: DiscoverTab
  sort: DiscoverVideoSort
  tag: string | null
}) {
  const params = new URLSearchParams()

  if (q) {
    params.set("q", q)
  }

  if (q && tab !== "videos") {
    params.set("tab", tab)
  }

  if (q && tab === "videos" && sort !== "latest") {
    params.set("sort", sort)
  }

  if (tag) {
    params.set("tag", tag)
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function normalizeQuery(input: string) {
  return input.replace(/\s+/g, " ").trim().slice(0, 120)
}

function loadRecentSearches() {
  if (typeof window === "undefined") {
    return [] as string[]
  }

  try {
    const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!stored) {
      return [] as string[]
    }

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return [] as string[]
    }

    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return [] as string[]
  }
}

function saveRecentSearches(values: string[]) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(values))
  } catch {
    // Ignore storage errors.
  }
}

function buildRecentSearches(nextValue: string, previousValues: string[]) {
  const normalized = normalizeQuery(nextValue)
  if (!normalized) {
    return previousValues
  }

  const deduped = [normalized, ...previousValues.filter((value) => value !== normalized)]
  return deduped.slice(0, MAX_RECENT_SEARCHES)
}

export function DiscoverPageClient({
  initialQuery,
  initialTab,
  initialSort,
  initialTag,
  tags,
  trendingVideos,
  latestVideos,
  initialVideoPage,
  initialUserPage,
}: DiscoverPageClientProps) {
  const pathname = usePathname()

  const [query, setQuery] = useState(initialQuery)
  const [tab, setTab] = useState<DiscoverTab>(initialTab)
  const [sort, setSort] = useState<DiscoverVideoSort>(initialSort)
  const [videoPage, setVideoPage] = useState<DiscoverVideoPagePayload>(initialVideoPage ?? EMPTY_VIDEO_PAGE)
  const [userPage, setUserPage] = useState<DiscoverUserPagePayload>(initialUserPage ?? EMPTY_USER_PAGE)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const hasQuery = Boolean(normalizeQuery(query))
  const firstLoadRef = useRef(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)
  const lastCompletedSearchKeyRef = useRef(`${initialQuery}|${initialTab}|${initialSort}`)

  const syncUrl = useCallback(
    (nextQuery: string, nextTab: DiscoverTab, nextSort: DiscoverVideoSort) => {
      if (typeof window === "undefined") {
        return
      }

      const href = createDiscoverHref({
        pathname,
        q: nextQuery,
        tab: nextTab,
        sort: nextSort,
        tag: initialTag,
      })

      window.history.replaceState(null, "", href)
    },
    [initialTag, pathname]
  )

  const fetchSearchPage = useCallback(
    async ({
      nextQuery,
      nextTab,
      nextSort,
      cursor,
      append,
    }: {
      nextQuery: string
      nextTab: DiscoverTab
      nextSort: DiscoverVideoSort
      cursor?: string | null
      append: boolean
    }) => {
      const normalized = normalizeQuery(nextQuery)

      if (!normalized) {
        setError(null)
        return false
      }

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }

      setError(null)
      const requestId = ++requestIdRef.current

      const params = new URLSearchParams({
        q: normalized,
        tab: nextTab,
        sort: nextSort,
      })

      if (initialTag) {
        params.set("tag", initialTag)
      }

      if (cursor) {
        params.set("cursor", cursor)
      }

      try {
        const response = await fetch(`/api/discover/search?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        })

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? "Unable to search right now.")
        }

        if (nextTab === "videos") {
          const payload = (await response.json()) as VideoSearchResponse

          if (!append && requestId !== requestIdRef.current) {
            return
          }

          setVideoPage((previousPage) => {
            if (!append) {
              return {
                items: payload.items,
                nextCursor: payload.nextCursor,
              }
            }

            const seenIds = new Set(previousPage.items.map((item) => item.id))
            const uniqueNextItems = payload.items.filter((item) => !seenIds.has(item.id))

            return {
              items: [...previousPage.items, ...uniqueNextItems],
              nextCursor: payload.nextCursor,
            }
          })
        } else {
          const payload = (await response.json()) as UserSearchResponse

          if (!append && requestId !== requestIdRef.current) {
            return
          }

          setUserPage((previousPage) => {
            if (!append) {
              return {
                items: payload.items,
                nextCursor: payload.nextCursor,
              }
            }

            const seenIds = new Set(previousPage.items.map((item) => item.id))
            const uniqueNextItems = payload.items.filter((item) => !seenIds.has(item.id))

            return {
              items: [...previousPage.items, ...uniqueNextItems],
              nextCursor: payload.nextCursor,
            }
          })
        }

        setRecentSearches((previousSearches) => {
          const nextSearches = buildRecentSearches(normalized, previousSearches)
          saveRecentSearches(nextSearches)
          return nextSearches
        })
        return true
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Unable to search right now."
        setError(message)

        if (!append) {
          if (nextTab === "videos") {
            setVideoPage(EMPTY_VIDEO_PAGE)
          } else {
            setUserPage(EMPTY_USER_PAGE)
          }
        }

        toast.error(message)
        return false
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [initialTag]
  )

  const applySearch = useCallback(
    async ({
      nextQuery,
      nextTab,
      nextSort,
      force = false,
    }: {
      nextQuery: string
      nextTab: DiscoverTab
      nextSort: DiscoverVideoSort
      force?: boolean
    }) => {
      const normalized = normalizeQuery(nextQuery)
      const searchKey = `${normalized}|${nextTab}|${nextSort}`
      syncUrl(normalized, nextTab, nextSort)

      if (!force && searchKey === lastCompletedSearchKeyRef.current) {
        return
      }

      if (!normalized) {
        lastCompletedSearchKeyRef.current = searchKey
        setError(null)
        return
      }

      const wasSuccessful = await fetchSearchPage({
        nextQuery: normalized,
        nextTab,
        nextSort,
        append: false,
      })

      if (wasSuccessful) {
        lastCompletedSearchKeyRef.current = searchKey
      }
    },
    [fetchSearchPage, syncUrl]
  )

  const loadMore = useCallback(async () => {
    const normalized = normalizeQuery(query)
    const cursor = tab === "videos" ? videoPage.nextCursor : userPage.nextCursor

    if (!normalized || !cursor || isLoadingMore || isLoading) {
      return
    }

    await fetchSearchPage({
      nextQuery: normalized,
      nextTab: tab,
      nextSort: sort,
      cursor,
      append: true,
    })
  }, [fetchSearchPage, isLoading, isLoadingMore, query, sort, tab, userPage.nextCursor, videoPage.nextCursor])

  const runImmediateSearch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    void applySearch({
      nextQuery: query,
      nextTab: tab,
      nextSort: sort,
      force: true,
    })
  }, [applySearch, query, sort, tab])

  useEffect(() => {
    setRecentSearches(loadRecentSearches())
  }, [])

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      void applySearch({
        nextQuery: query,
        nextTab: tab,
        nextSort: sort,
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [applySearch, query, sort, tab])

  const tagHrefBase = useMemo(
    () => ({
      pathname,
      q: normalizeQuery(query),
      tab,
      sort,
    }),
    [pathname, query, sort, tab]
  )

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="space-y-1">
            <Badge variant="outline">Discover</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Search videos and creators</h1>
            <p className="text-sm text-muted-foreground">Find clips by title or discover people by username and profile name.</p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    runImmediateSearch()
                  }

                  if (event.key === "Escape") {
                    event.preventDefault()
                    setQuery("")
                    void applySearch({
                      nextQuery: "",
                      nextTab: tab,
                      nextSort: sort,
                    })
                  }
                }}
                placeholder="Search videos, usernames, or creator names"
                className="h-11 pr-24 pl-9"
                aria-label="Search videos and users"
              />
              <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                {query ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => {
                      setQuery("")
                      void applySearch({
                        nextQuery: "",
                        nextTab: tab,
                        nextSort: sort,
                      })
                    }}
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={tab} onValueChange={(value) => setTab(value as DiscoverTab)} className="w-full sm:w-auto">
                <TabsList>
                  <TabsTrigger value="videos">
                    <Video className="size-4" />
                    Videos
                  </TabsTrigger>
                  <TabsTrigger value="users">
                    <UserRound className="size-4" />
                    Users
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {hasQuery && tab === "videos" ? (
                <div className="inline-flex items-center rounded-md border bg-background p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={sort === "latest" ? "secondary" : "ghost"}
                    onClick={() => setSort("latest")}
                  >
                    Latest
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sort === "top" ? "secondary" : "ghost"}
                    onClick={() => setSort("top")}
                  >
                    Top
                  </Button>
                </div>
              ) : null}
            </div>

            {tags.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  type="button"
                  size="xs"
                  variant={!initialTag ? "secondary" : "outline"}
                  className="h-7"
                >
                  <Link
                    href={createDiscoverHref({
                      ...tagHrefBase,
                      tag: null,
                    })}
                  >
                    All
                  </Link>
                </Button>
                {tags.map((tagOption) => (
                  <Button
                    key={tagOption.id}
                    asChild
                    type="button"
                    size="xs"
                    variant={initialTag === tagOption.name ? "secondary" : "outline"}
                    className="h-7"
                  >
                    <Link
                      href={createDiscoverHref({
                        ...tagHrefBase,
                        tag: tagOption.name,
                      })}
                    >
                      #{tagOption.name}
                    </Link>
                  </Button>
                ))}
              </div>
            ) : null}

            {!hasQuery && recentSearches.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Recent:</span>
                {recentSearches.map((recentSearch) => (
                  <Button
                    key={recentSearch}
                    type="button"
                    size="xs"
                    variant="outline"
                    className="h-7"
                    onClick={() => {
                      setQuery(recentSearch)
                      void applySearch({
                        nextQuery: recentSearch,
                        nextTab: tab,
                        nextSort: sort,
                      })
                    }}
                  >
                    {recentSearch}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {hasQuery ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Results for <span className="font-medium text-foreground">&quot;{normalizeQuery(query)}&quot;</span>
            </p>
            {initialTag ? <Badge variant="outline">#{initialTag}</Badge> : null}
          </div>

          {error ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4">
                <p className="text-sm text-destructive">{error}</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={runImmediateSearch}>
                  Retry search
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isLoading ? (
            tab === "videos" ? <VideoResultsSkeleton /> : <UserResultsSkeleton />
          ) : tab === "videos" ? (
            <SearchVideoResults
              items={videoPage.items}
              nextCursor={videoPage.nextCursor}
              isLoadingMore={isLoadingMore}
              onLoadMore={() => void loadMore()}
            />
          ) : (
            <SearchUserResults
              items={userPage.items}
              nextCursor={userPage.nextCursor}
              isLoadingMore={isLoadingMore}
              onLoadMore={() => void loadMore()}
            />
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-tight">Trending</h2>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="size-3.5" />
                Last 7 days
              </Badge>
            </div>
            {trendingVideos.length ? (
              <DiscoverVideoGrid items={trendingVideos} />
            ) : (
              <Empty className="border bg-muted/20">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Sparkles className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No trending videos yet</EmptyTitle>
                  <EmptyDescription>New activity will populate this section automatically.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Latest</h2>
            {latestVideos.length ? (
              <DiscoverVideoGrid items={latestVideos} />
            ) : (
              <Empty className="border bg-muted/20">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Video className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No latest videos</EmptyTitle>
                  <EmptyDescription>Publish a public READY video to appear in Discover.</EmptyDescription>
                </EmptyHeader>
                <Button asChild className="transition-transform hover:-translate-y-0.5">
                  <Link href="/upload">Upload a video</Link>
                </Button>
              </Empty>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function DiscoverVideoGrid({ items }: { items: DiscoverVideoItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <DiscoverVideoCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function DiscoverVideoCard({ item }: { item: DiscoverVideoItem }) {
  return (
    <Link
      href={`/v/${item.id}`}
      className="group overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
    >
      <div className="relative aspect-video border-b border-border/70 bg-muted/30">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={item.thumbnailUrl ? { backgroundImage: `url(${item.thumbnailUrl})` } : undefined}
        />
        {!item.thumbnailUrl ? (
          <div className="absolute inset-0 bg-linear-to-br from-primary/20 via-primary/5 to-muted" aria-hidden />
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold tracking-tight transition-colors group-hover:text-primary">{item.title}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar size="sm" className="size-5">
            <AvatarImage src={item.creator.avatarUrl ?? undefined} alt={item.creator.name ?? "Creator avatar"} />
            <AvatarFallback>{item.creator.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
          </Avatar>
          <span className="truncate">{item.creator.name ?? item.creator.username ?? "Creator"}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{item.likeCount} likes</span>
          <span>{item.commentCount} comments</span>
        </div>
      </div>
    </Link>
  )
}

function SearchVideoResults({
  items,
  nextCursor,
  isLoadingMore,
  onLoadMore,
}: {
  items: DiscoverVideoItem[]
  nextCursor: string | null
  isLoadingMore: boolean
  onLoadMore: () => void
}) {
  if (!items.length) {
    return (
      <Empty className="border bg-muted/20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search className="size-5" />
          </EmptyMedia>
          <EmptyTitle>No results</EmptyTitle>
          <EmptyDescription>Try different keywords, or switch to the Users tab.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <DiscoverVideoGrid items={items} />
      {nextCursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            Load more videos
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">You&apos;ve reached the end of video results.</p>
      )}
    </div>
  )
}

function SearchUserResults({
  items,
  nextCursor,
  isLoadingMore,
  onLoadMore,
}: {
  items: DiscoverUserItem[]
  nextCursor: string | null
  isLoadingMore: boolean
  onLoadMore: () => void
}) {
  if (!items.length) {
    return (
      <Empty className="border bg-muted/20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search className="size-5" />
          </EmptyMedia>
          <EmptyTitle>No results</EmptyTitle>
          <EmptyDescription>Try searching for a username, or switch to the Videos tab.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="border-border/60">
          <CardHeader className="flex-row items-center justify-between gap-3 p-4">
            <Link href={`/u/${item.username ?? item.id}`} className="group flex min-w-0 items-center gap-3">
              <Avatar className="ring-1 ring-border transition-all group-hover:ring-primary/40">
                <AvatarImage src={item.avatarUrl ?? undefined} alt={item.name ?? "User avatar"} />
                <AvatarFallback>{item.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold transition-colors group-hover:text-primary">{item.name ?? "Creator"}</p>
                <p className="truncate text-xs text-muted-foreground">@{item.username ?? item.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">{item.followersCount} followers</p>
              </div>
            </Link>
            <Button asChild size="sm" variant="outline">
              <Link href={`/u/${item.username ?? item.id}`}>View profile</Link>
            </Button>
          </CardHeader>
        </Card>
      ))}

      {nextCursor ? (
        <div className="flex justify-center pt-1">
          <Button type="button" variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            Load more users
          </Button>
        </div>
      ) : (
        <p className="pt-1 text-center text-xs text-muted-foreground">You&apos;ve reached the end of user results.</p>
      )}
    </div>
  )
}

function VideoResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="overflow-hidden border-border/60">
          <Skeleton className="aspect-video rounded-none" />
          <CardContent className="space-y-2 p-3">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-9/12" />
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function UserResultsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="border-border/60">
          <CardHeader className="flex-row items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-8 w-24" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
