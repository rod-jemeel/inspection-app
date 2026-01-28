import { z } from "zod"

export const uuidParam = z.string().uuid()

export const cursorQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CursorQuery = z.infer<typeof cursorQuery>
