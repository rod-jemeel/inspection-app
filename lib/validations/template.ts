import { z } from "zod"

export const createTemplateSchema = z.object({
  task: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  frequency: z.enum(["weekly", "monthly", "yearly", "every_3_years"]),
  default_assignee_profile_id: z.string().uuid().optional(),
  default_due_rule: z.record(z.string(), z.unknown()).optional(),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>

export const updateTemplateSchema = z.object({
  task: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  frequency: z.enum(["weekly", "monthly", "yearly", "every_3_years"]).optional(),
  default_assignee_profile_id: z.string().uuid().nullable().optional(),
  default_due_rule: z.record(z.string(), z.unknown()).nullable().optional(),
  active: z.boolean().optional(),
})

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
