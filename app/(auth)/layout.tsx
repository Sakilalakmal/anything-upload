import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth-guards"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (user) {
    redirect("/profile")
  }

  return <div className="mx-auto flex min-h-[70vh] w-full items-center justify-center">{children}</div>
}
