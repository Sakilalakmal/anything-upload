import { redirect } from "next/navigation"

import { ProfileNameForm } from "@/components/profile/profile-name-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth-guards"
import { prisma } from "@/lib/prisma"

export default async function ProfilePage() {
  const sessionUser = await requireUser()

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      email: true,
      name: true,
      createdAt: true,
    },
  })

  if (!user) {
    redirect("/sign-in")
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-medium">Email:</span> {user.email}
          </p>
          <p>
            <span className="font-medium">Display name:</span> {user.name ?? "Not set"}
          </p>
          <p>
            <span className="font-medium">Joined:</span>{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(user.createdAt)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update display name</CardTitle>
          <CardDescription>Keep this short and recognizable.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileNameForm name={user.name} />
        </CardContent>
      </Card>
    </div>
  )
}
