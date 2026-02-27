import Link from "next/link"
import { redirect } from "next/navigation"
import { Clapperboard, Heart, Users } from "lucide-react"

import { ProfileNameForm } from "@/components/profile/profile-name-form"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireUser } from "@/lib/auth-guards"
import { fetchUserProfileWithVideos } from "@/lib/data/users"

export default async function ProfilePage() {
  const sessionUser = await requireUser()

  const profile = await fetchUserProfileWithVideos({
    identifier: sessionUser.id,
    viewerId: sessionUser.id,
    limit: 12,
  })

  if (!profile) {
    redirect("/sign-in")
  }

  const joinedLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(profile.user.createdAt)

  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  })

  const publicProfileHref = `/u/${profile.user.username ?? profile.user.id}`
  const avatarInitial = profile.user.name?.charAt(0).toUpperCase() ?? profile.user.email.charAt(0).toUpperCase()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Card className="overflow-hidden border-border/60">
        <div className="bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-transparent p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar size="lg" className="ring-2 ring-background shadow-sm">
                <AvatarImage src={profile.user.avatarUrl ?? profile.user.image ?? undefined} alt={profile.user.name ?? "Profile avatar"} />
                <AvatarFallback>{avatarInitial}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{profile.user.name ?? "Creator"}</h1>
                <p className="text-sm text-muted-foreground">@{profile.user.username ?? "set-username"}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Joined {joinedLabel}</Badge>
                  <Badge variant="outline">{profile.user.email}</Badge>
                </div>
              </div>
            </div>
            <Button asChild variant="outline" className="transition-transform hover:-translate-y-0.5">
              <Link href={publicProfileHref}>View public profile</Link>
            </Button>
          </div>
        </div>
        <CardContent className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40">
            <p className="text-xs text-muted-foreground">Videos</p>
            <p className="mt-1 text-2xl font-semibold">{compact.format(profile.stats.videos)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40">
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="mt-1 text-2xl font-semibold">{compact.format(profile.stats.followers)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40">
            <p className="text-xs text-muted-foreground">Following</p>
            <p className="mt-1 text-2xl font-semibold">{compact.format(profile.stats.following)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40">
            <p className="text-xs text-muted-foreground">Likes received</p>
            <p className="mt-1 text-2xl font-semibold">{compact.format(profile.stats.likesReceived)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <Card className="h-fit border-border/60">
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>Update your public details and creator identity.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileNameForm name={profile.user.name} username={profile.user.username} bio={profile.user.bio} />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle>Content</CardTitle>
            <CardDescription>Manage videos and audience activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="videos" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="videos">
                  <Clapperboard className="size-4" />
                  Videos
                </TabsTrigger>
                <TabsTrigger value="likes">
                  <Heart className="size-4" />
                  Likes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="videos" className="space-y-4">
                {profile.videos.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
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
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{video._count.likes} likes</span>
                          <span>{video._count.comments} comments</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty className="border bg-muted/20">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Clapperboard className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle>No videos yet</EmptyTitle>
                      <EmptyDescription>Your uploads will show here once Phase 3 video upload is added.</EmptyDescription>
                    </EmptyHeader>
                    <Button asChild className="transition-transform hover:-translate-y-0.5">
                      <Link href="/upload">Go to upload placeholder</Link>
                    </Button>
                  </Empty>
                )}
              </TabsContent>

              <TabsContent value="likes">
                <Empty className="border bg-muted/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Users className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>Likes tab coming next</EmptyTitle>
                    <EmptyDescription>
                      Phase 2 includes the data model and counters. Detailed liked-videos browsing can be layered on in Phase 3.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
