import { z } from "zod"

export const fieldTypeEnum = z.enum([
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "multi_select",
  "signature",
  "photo",
  "temperature",
  "pressure",
  "section_header",
])

export type FieldType = z.infer<typeof fieldTypeEnum>

export const validationRulesSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  min_length: z.number().int().optional(),
  max_length: z.number().int().optional(),
  allow_na: z.boolean().optional(),
}).optional()

export type ValidationRules = z.infer<typeof validationRulesSchema>

export const createFormFieldSchema = z.object({
  form_template_id: z.string().uuid(),
  label: z.string().min(1).max(200),
  field_type: fieldTypeEnum,
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  validation_rules: validationRulesSchema,
  help_text: z.string().max(1000).optional(),
  placeholder: z.string().max(200).optional(),
  default_value: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).default(0),
})

export type CreateFormFieldInput = z.infer<typeof createFormFieldSchema>

export const updateFormFieldSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  field_type: fieldTypeEnum.optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).nullable().optional(),
  validation_rules: validationRulesSchema.nullable(),
  help_text: z.string().max(1000).nullable().optional(),
  placeholder: z.string().max(200).nullable().optional(),
  default_value: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

export type UpdateFormFieldInput = z.infer<typeof updateFormFieldSchema>

export const reorderFieldsSchema = z.object({
  field_ids: z.array(z.string().uuid()).min(1),
})

export type ReorderFieldsInput = z.infer<typeof reorderFieldsSchema>
