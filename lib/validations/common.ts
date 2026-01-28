import { z } from "zod"

export const uuidParam = z.string().uuid()

// Prefixed ID schemas for inspection domain
export const templateIdSchema = z.string().regex(/^tmpl_\d+$/, "Invalid template ID format")
export const instanceIdSchema = z.string().regex(/^insp_\d+$/, "Invalid instance ID format")

export const cursorQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CursorQuery = z.infer<typeof cursorQuery>
