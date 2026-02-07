import "server-only"
import { unstable_cache, revalidateTag } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type {
  CreateFormFieldInput,
  UpdateFormFieldInput,
  ReorderFieldsInput,
} from "@/lib/validations/form-field"

function revalidateFieldsCache(formTemplateId: string) {
  revalidateTag("form-fields", "max")
  revalidateTag(`form-fields-${formTemplateId}`, "max")
}

export interface FormField {
  id: string
  form_template_id: string
  label: string
  field_type: string
  required: boolean
  options: string[] | null
  validation_rules: Record<string, unknown> | null
  help_text: string | null
  placeholder: string | null
  default_value: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

async function fetchFormFields(formTemplateId: string, active?: boolean) {
  let query = supabase
    .from("form_fields")
    .select("*")
    .eq("form_template_id", formTemplateId)
    .order("sort_order", { ascending: true })

  if (active !== undefined) {
    query = query.eq("active", active)
  }

  const { data, error } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return (data ?? []) as FormField[]
}

export async function listFormFields(formTemplateId: string, opts?: { active?: boolean }) {
  const getCached = unstable_cache(
    () => fetchFormFields(formTemplateId, opts?.active),
    ["form-fields", formTemplateId, String(opts?.active)],
    { revalidate: 60, tags: ["form-fields", `form-fields-${formTemplateId}`] }
  )
  return getCached()
}

export async function getFormField(fieldId: string) {
  const { data, error } = await supabase
    .from("form_fields")
    .select("*")
    .eq("id", fieldId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Form field not found")
  return data as FormField
}

export async function createFormField(input: CreateFormFieldInput) {
  const { data, error } = await supabase
    .from("form_fields")
    .insert({
      form_template_id: input.form_template_id,
      label: input.label,
      field_type: input.field_type,
      required: input.required,
      options: input.options ?? null,
      validation_rules: input.validation_rules ?? null,
      help_text: input.help_text ?? null,
      placeholder: input.placeholder ?? null,
      default_value: input.default_value ?? null,
      sort_order: input.sort_order,
    })
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  revalidateFieldsCache(input.form_template_id)
  return data as FormField
}

export async function updateFormField(fieldId: string, input: UpdateFormFieldInput) {
  // Get existing to know form_template_id for cache invalidation
  const existing = await getFormField(fieldId)

  const { data, error } = await supabase
    .from("form_fields")
    .update(input)
    .eq("id", fieldId)
    .select()
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Form field not found")

  revalidateFieldsCache(existing.form_template_id)
  return data as FormField
}

export async function deleteFormField(fieldId: string) {
  const existing = await getFormField(fieldId)

  // Soft delete
  const { error } = await supabase
    .from("form_fields")
    .update({ active: false })
    .eq("id", fieldId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  revalidateFieldsCache(existing.form_template_id)
}

export async function reorderFormFields(formTemplateId: string, input: ReorderFieldsInput) {
  const updates = input.field_ids.map((id, index) =>
    supabase
      .from("form_fields")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("form_template_id", formTemplateId)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    throw new ApiError("INTERNAL_ERROR", "Failed to reorder fields")
  }

  revalidateFieldsCache(formTemplateId)
}
