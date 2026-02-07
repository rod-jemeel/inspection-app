import "server-only"
import { unstable_cache, revalidateTag } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type {
  CreateFormTemplateInput,
  UpdateFormTemplateInput,
  DuplicateFormTemplateInput,
} from "@/lib/validations/form-template"

function revalidateFormTemplatesCache(locationId: string, binderId?: string) {
  revalidateTag("form-templates", "max")
  revalidateTag(`form-templates-${locationId}`, "max")
  if (binderId) revalidateTag(`form-templates-binder-${binderId}`, "max")
}

export interface FormTemplate {
  id: string
  binder_id: string
  location_id: string
  name: string
  description: string | null
  instructions: string | null
  frequency: string | null
  default_assignee_profile_id: string | null
  regulatory_reference: string | null
  retention_years: number | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
  created_by_profile_id: string | null
  field_count?: number
}

async function fetchFormTemplates(locationId: string, binderId: string, active?: boolean) {
  let query = supabase
    .from("form_templates")
    .select("*")
    .eq("location_id", locationId)
    .eq("binder_id", binderId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (active !== undefined) {
    query = query.eq("active", active)
  }

  const { data, error } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  // Get field counts
  const templates = data ?? []
  if (templates.length === 0) return [] as FormTemplate[]

  const templateIds = templates.map((t: { id: string }) => t.id)
  const { data: fieldCounts } = await supabase
    .from("form_fields")
    .select("form_template_id")
    .in("form_template_id", templateIds)
    .eq("active", true)

  const countMap: Record<string, number> = {}
  for (const row of fieldCounts ?? []) {
    countMap[row.form_template_id] = (countMap[row.form_template_id] || 0) + 1
  }

  return templates.map((t: Record<string, unknown>) => ({
    ...t,
    field_count: countMap[t.id as string] || 0,
  })) as FormTemplate[]
}

export async function listFormTemplates(
  locationId: string,
  binderId: string,
  opts?: { active?: boolean }
) {
  const getCached = unstable_cache(
    () => fetchFormTemplates(locationId, binderId, opts?.active),
    ["form-templates", locationId, binderId, String(opts?.active)],
    {
      revalidate: 60,
      tags: [
        "form-templates",
        `form-templates-${locationId}`,
        `form-templates-binder-${binderId}`,
      ],
    }
  )
  return getCached()
}

export async function getFormTemplate(locationId: string, formId: string) {
  const { data, error } = await supabase
    .from("form_templates")
    .select("*")
    .eq("id", formId)
    .eq("location_id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Form template not found")
  return data as FormTemplate
}

export async function createFormTemplate(
  locationId: string,
  profileId: string,
  input: CreateFormTemplateInput
) {
  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      location_id: locationId,
      created_by_profile_id: profileId,
      ...input,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new ApiError("VALIDATION_ERROR", `A form named "${input.name}" already exists in this binder`)
    }
    throw new ApiError("INTERNAL_ERROR", error.message)
  }

  revalidateFormTemplatesCache(locationId, input.binder_id)
  return { ...data, field_count: 0 } as FormTemplate
}

export async function updateFormTemplate(
  locationId: string,
  formId: string,
  input: UpdateFormTemplateInput
) {
  // Get existing to know the binder_id for cache invalidation
  const existing = await getFormTemplate(locationId, formId)

  const { data, error } = await supabase
    .from("form_templates")
    .update(input)
    .eq("id", formId)
    .eq("location_id", locationId)
    .select()
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Form template not found")

  revalidateFormTemplatesCache(locationId, existing.binder_id)
  return data as FormTemplate
}

export async function deleteFormTemplate(locationId: string, formId: string) {
  const existing = await getFormTemplate(locationId, formId)

  const { error } = await supabase
    .from("form_templates")
    .update({ active: false })
    .eq("id", formId)
    .eq("location_id", locationId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  revalidateFormTemplatesCache(locationId, existing.binder_id)
}

export async function duplicateFormTemplate(
  locationId: string,
  profileId: string,
  input: DuplicateFormTemplateInput
) {
  // Get source template
  const source = await getFormTemplate(locationId, input.source_form_id)
  const targetBinderId = input.target_binder_id ?? source.binder_id

  // Create new template
  const { data: newTemplate, error } = await supabase
    .from("form_templates")
    .insert({
      binder_id: targetBinderId,
      location_id: locationId,
      name: input.new_name,
      description: source.description,
      instructions: source.instructions,
      frequency: source.frequency,
      default_assignee_profile_id: source.default_assignee_profile_id,
      regulatory_reference: source.regulatory_reference,
      retention_years: source.retention_years,
      sort_order: source.sort_order,
      created_by_profile_id: profileId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new ApiError("VALIDATION_ERROR", `A form named "${input.new_name}" already exists in this binder`)
    }
    throw new ApiError("INTERNAL_ERROR", error.message)
  }

  // Copy fields if requested
  if (input.copy_fields) {
    const { data: fields } = await supabase
      .from("form_fields")
      .select("label, field_type, required, options, validation_rules, help_text, placeholder, default_value, sort_order, active")
      .eq("form_template_id", input.source_form_id)
      .order("sort_order", { ascending: true })

    if (fields && fields.length > 0) {
      const newFields = fields.map((f: Record<string, unknown>) => ({
        ...f,
        form_template_id: newTemplate.id,
      }))

      await supabase.from("form_fields").insert(newFields)
    }
  }

  revalidateFormTemplatesCache(locationId, targetBinderId)
  return { ...newTemplate, field_count: 0 } as FormTemplate
}

export async function reorderFormTemplates(
  locationId: string,
  binderId: string,
  orderedIds: string[]
) {
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("form_templates")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("location_id", locationId)
      .eq("binder_id", binderId)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    throw new ApiError("INTERNAL_ERROR", "Failed to reorder form templates")
  }

  revalidateFormTemplatesCache(locationId, binderId)
}
