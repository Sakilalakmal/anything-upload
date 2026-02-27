import Link from "next/link"

import { signOutAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth-guards"

export async function Navbar() {
  const user = await getCurrentUser()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link className="font-semibold tracking-tight" href="/">
          Anything
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/profile" prefetch={false}>
                  Profile
                </Link>
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="outline">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
