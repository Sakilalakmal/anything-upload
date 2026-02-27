import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { auth } from "@/lib/auth"

export const getCurrentSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  })
})

export async function getCurrentUser() {
  const session = await getCurrentSession()
  return session?.user ?? null
}

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>
export type AuthUser = AuthSession["user"]

export async function requireUser() {
  const session = await getCurrentSession()

  if (!session?.user) {
    redirect("/sign-in")
  }

  return session.user as AuthUser
}
