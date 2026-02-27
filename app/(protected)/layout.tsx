import { requireUser } from "@/lib/auth-guards"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser()

  return children
}
