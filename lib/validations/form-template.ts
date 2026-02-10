import { z } from "zod"

export const formFrequencyEnum = z.enum([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
  "yearly",
  "every_3_years",
  "as_needed",
])

export type FormFrequency = z.infer<typeof formFrequencyEnum>

export const createFormTemplateSchema = z.object({
  binder_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  instructions: z.string().max(5000).optional(),
  frequency: formFrequencyEnum,
  default_assignee_profile_id: z.string().uuid().optional(),
  regulatory_reference: z.string().max(500).optional(),
  retention_years: z.number().int().min(1).max(99).optional(),
  sort_order: z.number().int().min(0).default(0),
  google_sheet_id: z.string().max(200).optional(),
  google_sheet_tab: z.string().max(200).optional(),
})

export type CreateFormTemplateInput = z.infer<typeof createFormTemplateSchema>

export const updateFormTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  instructions: z.string().max(5000).nullable().optional(),
  frequency: formFrequencyEnum.optional(),
  default_assignee_profile_id: z.string().uuid().nullable().optional(),
  regulatory_reference: z.string().max(500).nullable().optional(),
  retention_years: z.number().int().min(1).max(99).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  google_sheet_id: z.string().max(200).nullable().optional(),
  google_sheet_tab: z.string().max(200).nullable().optional(),
})

export type UpdateFormTemplateInput = z.infer<typeof updateFormTemplateSchema>

export const duplicateFormTemplateSchema = z.object({
  source_form_id: z.string().uuid(),
  new_name: z.string().min(1).max(200),
  target_binder_id: z.string().uuid().optional(),
  copy_fields: z.boolean().default(true),
})

export type DuplicateFormTemplateInput = z.infer<typeof duplicateFormTemplateSchema>
