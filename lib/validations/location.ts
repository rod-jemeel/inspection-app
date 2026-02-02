import { z } from "zod"

// Common timezones for healthcare facilities
export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const

export const updateLocationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  address: z.string().max(500).optional(),
  timezone: z.enum(TIMEZONES).optional(),
  active: z.boolean().optional(),
})

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "nurse", "inspector"]),
})

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
