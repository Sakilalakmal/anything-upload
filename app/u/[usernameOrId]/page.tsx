import Link from "next/link"
import { notFound } from "next/navigation"
import { Clapperboard, UserRound } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FollowButton } from "@/components/social/follow-button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCurrentUser } from "@/lib/auth-guards"
import { fetchUserProfileWithVideos } from "@/lib/data/users"

type PublicProfilePageProps = {
  params: Promise<{
    usernameOrId: string
  }>
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { usernameOrId } = await params
  const viewer = await getCurrentUser()

  const profile = await fetchUserProfileWithVideos({
    identifier: usernameOrId,
    viewerId: viewer?.id ?? null,
    limit: 12,
  })

  if (!profile) {
    notFound()
  }

  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Card className="overflow-hidden border-border/60">
        <div className="bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-transparent p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar size="lg" className="ring-2 ring-background shadow-sm">
                <AvatarImage src={profile.user.avatarUrl ?? profile.user.image ?? undefined} alt={profile.user.name ?? "Profile avatar"} />
                <AvatarFallback>{profile.user.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{profile.user.name ?? "Creator"}</h1>
                <p className="text-sm text-muted-foreground">@{profile.user.username ?? profile.user.id.slice(0, 8)}</p>
                {profile.user.bio ? <p className="text-sm text-muted-foreground">{profile.user.bio}</p> : null}
              </div>
            </div>
            {profile.viewer.isOwner ? (
              <Button asChild variant="outline" className="transition-transform hover:-translate-y-0.5">
                <Link href="/profile">Edit profile</Link>
              </Button>
            ) : (
              <FollowButton
                targetUserId={profile.user.id}
                profilePath={`/u/${profile.user.username ?? profile.user.id}`}
                initialFollowing={profile.viewer.isFollowing}
                initialFollowerCount={profile.stats.followers}
                isAuthenticated={Boolean(viewer)}
              />
            )}
          </div>
        </div>
        <CardContent className="grid gap-3 p-6 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Videos</p>
            <p className="mt-1 text-2xl font-semibold">{compact.format(profile.stats.videos)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="mt-1 text-2xl font-semibold">{compact.format(profile.stats.followers)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Following</p>
            <p className="mt-1 text-2xl font-semibold">{compact.format(profile.stats.following)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle>Public profile</CardTitle>
          <CardDescription>Follow creators, explore uploads, and join discussions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="videos">
            <TabsList className="mb-4">
              <TabsTrigger value="videos">
                <Clapperboard className="size-4" />
                Videos
              </TabsTrigger>
              <TabsTrigger value="about">
                <UserRound className="size-4" />
                About
              </TabsTrigger>
            </TabsList>
            <TabsContent value="videos">
              {profile.videos.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {profile.videos.map((video) => (
                    <Link
                      key={video.id}
                      href={`/v/${video.id}`}
                      className="group rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="secondary">{video.visibility}</Badge>
                        <Badge variant="outline">{video.status}</Badge>
                      </div>
                      <h3 className="line-clamp-1 text-sm font-semibold transition-colors group-hover:text-primary">{video.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {video.description ?? "No description yet."}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty className="border bg-muted/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Clapperboard className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>No public videos</EmptyTitle>
                    <EmptyDescription>This creator has not published videos yet.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsContent>
            <TabsContent value="about">
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">{profile.user.bio ?? "No bio yet."}</p>
                <p className="text-muted-foreground">Total likes received: {compact.format(profile.stats.likesReceived)}</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
