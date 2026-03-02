import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { auth } from "@/lib/auth"
import { isPrismaDatabaseConnectivityError } from "@/lib/prisma-errors"

export const getCurrentSession = cache(async () => {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    })
  } catch (error) {
    if (isPrismaDatabaseConnectivityError(error)) {
      return null
    }

    throw error
  }
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

export async function requireUserOrThrow(message = "You must be signed in.") {
  const session = await getCurrentSession()

  if (!session?.user) {
    throw new Error(message)
  }

  return session.user as AuthUser
}
