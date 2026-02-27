import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth-guards"

export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Welcome to Anything</CardTitle>
          <CardDescription>Phase 1 authentication is ready with Better Auth, Prisma, and Neon Postgres.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {user ? (
            <>
              <Button asChild>
                <Link href="/profile">Go to profile</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/upload">Go to upload</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/sign-up">Create account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
