import { z } from "zod"

export const instanceStatusEnum = z.enum([
  "pending",
  "in_progress",
  "failed",
  "passed",
  "void",
])

export type InstanceStatus = z.infer<typeof instanceStatusEnum>

export const createInstanceSchema = z.object({
  template_id: z.string().uuid(),
  due_at: z.string().datetime(),
  assigned_to_profile_id: z.string().uuid().optional(),
  assigned_to_email: z.string().email().optional(),
})

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>

export const updateInstanceSchema = z.object({
  status: z.enum(["in_progress", "failed", "passed", "void"]).optional(),
  remarks: z.string().max(5000).optional(),
  inspected_at: z.string().datetime().optional(),
})

export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>

export const instanceFilterSchema = z.object({
  status: instanceStatusEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  assignee: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type InstanceFilters = z.infer<typeof instanceFilterSchema>
