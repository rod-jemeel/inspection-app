import { z } from "zod"

// Binder schemas
export const createBinderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  sort_order: z.number().int().min(0).default(0),
})

export type CreateBinderInput = z.infer<typeof createBinderSchema>

export const updateBinderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

export type UpdateBinderInput = z.infer<typeof updateBinderSchema>

// Binder assignment schemas
export const binderAssignmentEntrySchema = z.object({
  profile_id: z.string().uuid(),
  can_edit: z.boolean().default(false),
})

export const updateBinderAssignmentsSchema = z.object({
  assignments: z.array(binderAssignmentEntrySchema),
})

export type UpdateBinderAssignmentsInput = z.infer<typeof updateBinderAssignmentsSchema>
