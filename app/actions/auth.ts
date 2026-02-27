"use server"

import { APIError } from "better-auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { auth } from "@/lib/auth"

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  redirectTo: z.string().optional(),
})

const signUpSchema = z.object({
  name: z.string().trim().max(60, "Name must be 60 characters or less.").optional(),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  redirectTo: z.string().optional(),
})

type AuthFormState = {
  error?: string
  fieldErrors?: {
    email?: string[]
    password?: string[]
    name?: string[]
  }
}

function normalizeRedirectPath(pathname: string | undefined) {
  if (pathname && pathname.startsWith("/") && !pathname.startsWith("//")) {
    return pathname
  }

  return "/profile"
}

function getActionValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof APIError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

function fallbackName(rawName: string, email: string) {
  const trimmedName = rawName.trim()

  if (trimmedName) {
    return trimmedName
  }

  const localPart = email.split("@")[0]?.trim()
  return localPart || "New User"
}

export async function signInAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: getActionValue(formData, "email"),
    password: getActionValue(formData, "password"),
    redirectTo: getActionValue(formData, "redirectTo"),
  })

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const redirectTo = normalizeRedirectPath(parsed.data.redirectTo)

  try {
    await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    })
  } catch (error) {
    return {
      error: getAuthErrorMessage(error),
    }
  }

  redirect(redirectTo)
}

export async function signUpAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: getActionValue(formData, "name"),
    email: getActionValue(formData, "email"),
    password: getActionValue(formData, "password"),
    redirectTo: getActionValue(formData, "redirectTo"),
  })

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const redirectTo = normalizeRedirectPath(parsed.data.redirectTo)
  const name = fallbackName(parsed.data.name ?? "", parsed.data.email)

  try {
    await auth.api.signUpEmail({
      body: {
        name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    })
  } catch (error) {
    return {
      error: getAuthErrorMessage(error),
    }
  }

  redirect(redirectTo)
}

export async function signOutAction() {
  await auth.api.signOut({
    headers: await headers(),
  })

  redirect("/sign-in")
}
