import { z } from "zod"

export const responseStatusEnum = z.enum(["draft", "complete", "flagged"])

export type ResponseStatus = z.infer<typeof responseStatusEnum>

export const fieldResponseSchema = z.object({
  form_field_id: z.string().uuid(),
  value_text: z.string().optional(),
  value_number: z.number().optional(),
  value_boolean: z.boolean().optional(),
  value_date: z.string().date().optional(),
  value_datetime: z.string().datetime().optional(),
  value_json: z.record(z.string(), z.unknown()).optional(),
  attachment_url: z.string().optional(),
  pass: z.boolean().optional(),
})

export type FieldResponseInput = z.infer<typeof fieldResponseSchema>

export const submitFormResponseSchema = z.object({
  form_template_id: z.string().uuid(),
  inspection_instance_id: z.string().uuid().optional(),
  status: responseStatusEnum.default("complete"),
  remarks: z.string().max(5000).optional(),
  corrective_action: z.string().max(5000).optional(),
  field_responses: z.array(fieldResponseSchema).min(1),
})

export type SubmitFormResponseInput = z.infer<typeof submitFormResponseSchema>

export const updateFormResponseSchema = z.object({
  status: responseStatusEnum.optional(),
  remarks: z.string().max(5000).nullable().optional(),
  corrective_action: z.string().max(5000).nullable().optional(),
  field_responses: z.array(fieldResponseSchema).optional(),
})

export type UpdateFormResponseInput = z.infer<typeof updateFormResponseSchema>

export const filterResponsesSchema = z.object({
  binder_id: z.string().uuid().optional(),
  form_template_id: z.string().uuid().optional(),
  submitted_by_profile_id: z.string().uuid().optional(),
  status: responseStatusEnum.optional(),
  overall_pass: z.coerce.boolean().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type FilterResponsesInput = z.infer<typeof filterResponsesSchema>
