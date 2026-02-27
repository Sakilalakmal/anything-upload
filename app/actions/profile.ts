"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth-guards"
import { prisma } from "@/lib/prisma"

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .max(60, "Display name must be 60 characters or less.")
    .transform((value) => (value ? value : null)),
})

type ProfileFormState = {
  error?: string
  success?: string
  fieldErrors?: {
    name?: string[]
  }
}

export async function updateProfileNameAction(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({
    name: typeof formData.get("name") === "string" ? formData.get("name") : "",
  })

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const user = await requireUser()

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
    },
  })

  revalidatePath("/profile")

  return {
    success: "Profile updated.",
  }
}
