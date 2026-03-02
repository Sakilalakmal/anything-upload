import { z } from "zod"

import { userIdSchema } from "@/lib/validations/social"

export const discoverTabSchema = z.enum(["videos", "users"])
export const discoverVideoSortSchema = z.enum(["latest", "top"])

const discoverQueryBaseSchema = z
  .string()
  .trim()
  .max(120, "Search query must be 120 characters or less.")
  .transform((value) => value.replace(/\s+/g, " ").trim())

const discoverTagBaseSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(50, "Tag filter must be 50 characters or less.")

const optionalCursorSchema = z.string().trim().min(1).nullable().optional()

export const discoverPageQuerySchema = z.object({
  q: discoverQueryBaseSchema
    .optional()
    .transform((value) => (value && value.length > 0 ? value : "")),
  tab: discoverTabSchema.optional().default("videos"),
  sort: discoverVideoSortSchema.optional().default("latest"),
  tag: discoverTagBaseSchema
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
})

export const searchVideosInputSchema = z.object({
  q: discoverQueryBaseSchema.refine((value) => value.length > 0, "Search query is required."),
  cursor: optionalCursorSchema,
  take: z.number().int().min(1).max(50).optional(),
  sort: discoverVideoSortSchema.optional().default("latest"),
  tag: discoverTagBaseSchema
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  viewerId: userIdSchema.nullable().optional(),
})

export const searchUsersInputSchema = z.object({
  q: discoverQueryBaseSchema.refine((value) => value.length > 0, "Search query is required."),
  cursor: optionalCursorSchema,
  take: z.number().int().min(1).max(50).optional(),
})

export const discoverSearchRouteQuerySchema = z.object({
  q: discoverQueryBaseSchema.refine((value) => value.length > 0, "Search query is required."),
  tab: discoverTabSchema.optional().default("videos"),
  cursor: optionalCursorSchema,
  take: z.coerce.number().int().min(1).max(50).optional(),
  sort: discoverVideoSortSchema.optional().default("latest"),
  tag: discoverTagBaseSchema
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
})

export type DiscoverPageQuery = z.infer<typeof discoverPageQuerySchema>
export type SearchVideosInput = z.infer<typeof searchVideosInputSchema>
export type SearchUsersInput = z.infer<typeof searchUsersInputSchema>
