import Link from "next/link"
import { Compass, Plus, Search } from "lucide-react"

import { signOutAction } from "@/app/actions/auth"
import { MessagesNavLink } from "@/components/messages/messages-nav-link"
import { InboxNavLink } from "@/components/notifications/inbox-nav-link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AuthUser } from "@/lib/auth-guards"

export function Navbar({ user }: { user: AuthUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-[1280px] items-center gap-3 px-3 sm:px-4 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-[#111111] text-lg font-black text-white shadow-[4px_4px_0_0_rgba(254,44,85,0.18)]">
            A
          </span>
          <span className="text-2xl font-black tracking-tight text-foreground">Anything</span>
        </Link>

        <form action="/discover" className="mx-auto hidden w-full max-w-xl md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              placeholder="Search accounts and videos"
              className="h-12 rounded-full border-none bg-[#f1f1f2] pr-4 pl-11 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-[#111111]/10"
            />
          </div>
        </form>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" className="hidden rounded-xl px-4 md:inline-flex">
            <Link href="/discover" prefetch={false}>
              <Compass className="size-4" />
              Discover
            </Link>
          </Button>

          {user ? (
            <>
              <Button asChild variant="outline" className="rounded-xl border-black/10 bg-white px-4 shadow-none">
                <Link href="/upload" prefetch={false}>
                  <Plus className="size-4" />
                  Upload
                </Link>
              </Button>
              <MessagesNavLink className="rounded-xl px-3" />
              <InboxNavLink className="rounded-xl px-3" />
              <Button asChild variant="ghost" className="size-11 rounded-full p-0">
                <Link href="/profile" prefetch={false} aria-label="Profile">
                  <Avatar className="size-9 ring-1 ring-black/10">
                    <AvatarImage src={user.image ?? undefined} alt={user.name ?? "Profile avatar"} />
                    <AvatarFallback>{(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" className="hidden rounded-xl lg:inline-flex">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="rounded-xl px-4">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild className="rounded-xl bg-[#fe2c55] text-white hover:bg-[#e9294f]">
                <Link href="/sign-up">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
