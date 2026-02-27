import { z } from "zod"

const usernamePattern = /^[a-z0-9_]{3,24}$/

export const usernameUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .max(24, "Username must be 24 characters or less.")
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || usernamePattern.test(value), {
      message: "Use 3-24 lowercase letters, numbers, or underscores.",
    }),
})

export const profileUpdateSchema = usernameUpdateSchema.extend({
  name: z
    .string()
    .trim()
    .max(60, "Display name must be 60 characters or less.")
    .optional()
    .transform((value) => (value ? value : null)),
  bio: z
    .string()
    .trim()
    .max(280, "Bio must be 280 characters or less.")
    .optional()
    .transform((value) => (value ? value : null)),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
