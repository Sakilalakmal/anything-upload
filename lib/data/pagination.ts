import { z } from "zod"

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 12

const cursorPayloadSchema = z.object({
  id: z.string().cuid(),
  createdAt: z.coerce.date(),
})

export type CursorPayload = z.infer<typeof cursorPayloadSchema>

export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
}

export function normalizeLimit(limit: number | undefined, fallback = DEFAULT_LIMIT) {
  if (!Number.isFinite(limit)) {
    return fallback
  }

  const safeLimit = Math.floor(limit ?? fallback)
  return Math.min(Math.max(safeLimit, 1), MAX_LIMIT)
}

export function encodeCursor(cursor: CursorPayload) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

export function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null
  }

  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8")
    return cursorPayloadSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export function toCursorPage<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number
): CursorPage<T> {
  if (rows.length <= limit) {
    return {
      items: rows,
      nextCursor: null,
    }
  }

  const items = rows.slice(0, limit)
  const lastItem = items.at(-1)

  return {
    items,
    nextCursor: lastItem
      ? encodeCursor({
          id: lastItem.id,
          createdAt: lastItem.createdAt,
        })
      : null,
  }
}
