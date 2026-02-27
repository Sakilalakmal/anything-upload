"use server"

import { revalidatePath } from "next/cache"
import { UsernameAlreadyInUseError, updateCurrentUserProfile } from "@/lib/data/users"
import { profileUpdateSchema } from "@/lib/validations/users"

type ProfileFormState = {
  error?: string
  success?: string
  fieldErrors?: {
    name?: string[]
    username?: string[]
    bio?: string[]
  }
}

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = profileUpdateSchema.safeParse({
    name: typeof formData.get("name") === "string" ? formData.get("name") : "",
    username: typeof formData.get("username") === "string" ? formData.get("username") : "",
    bio: typeof formData.get("bio") === "string" ? formData.get("bio") : "",
  })

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    await updateCurrentUserProfile(parsed.data)
  } catch (error) {
    if (error instanceof UsernameAlreadyInUseError) {
      return {
        fieldErrors: {
          username: [error.message],
        },
      }
    }

    return {
      error: "Unable to update profile right now. Please try again.",
    }
  }

  revalidatePath("/profile")

  return {
    success: "Profile updated.",
  }
}
