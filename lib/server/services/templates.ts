import "server-only"
import { unstable_cache, revalidateTag } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { CreateTemplateInput, UpdateTemplateInput } from "@/lib/validations/template"
import { calculateNextDueDate, createInstance } from "./instances"

// Helper to revalidate templates cache
function revalidateTemplatesCache(locationId: string) {
  revalidateTag("templates", "max")
  revalidateTag(`templates-${locationId}`, "max")
}

export interface Template {
  id: string
  location_id: string
  task: string
  description: string | null
  frequency: "weekly" | "monthly" | "yearly" | "every_3_years"
  default_assignee_profile_id: string | null
  default_assignee_email: string | null
  default_due_rule: Record<string, unknown> | null
  active: boolean
  sort_order: number
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
  binder_id: string | null
  form_template_id: string | null
  created_by_name?: string | null
  updated_by_name?: string | null
  assignee_name?: string | null
}

async function fetchTemplates(locationId: string, active?: boolean, binderId?: string) {
  // Use JOINs to get user names in a single query
  let query = supabase
    .from("inspection_templates")
    .select(`
      id, location_id, task, description, frequency,
      default_assignee_profile_id, default_assignee_email, default_due_rule,
      active, sort_order, created_by, updated_by, created_at, updated_at,
      binder_id, form_template_id,
      created_by_profile:profiles!inspection_templates_created_by_profile_fkey(full_name),
      updated_by_profile:profiles!inspection_templates_updated_by_profile_fkey(full_name),
      assignee_profile:profiles!inspection_templates_default_assignee_profile_id_fkey(full_name)
    `)
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (active !== undefined) {
    query = query.eq("active", active)
  }

  if (binderId !== undefined) {
    query = query.eq("binder_id", binderId)
  }

  const { data, error } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  // Map the joined data to the expected format
  return (data ?? []).map((row: any) => ({
    id: row.id,
    location_id: row.location_id,
    task: row.task,
    description: row.description,
    frequency: row.frequency,
    default_assignee_profile_id: row.default_assignee_profile_id,
    default_assignee_email: row.default_assignee_email,
    default_due_rule: row.default_due_rule,
    active: row.active,
    sort_order: row.sort_order,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    binder_id: row.binder_id,
    form_template_id: row.form_template_id,
    created_by_name: row.created_by_profile?.full_name ?? null,
    updated_by_name: row.updated_by_profile?.full_name ?? null,
    assignee_name: row.assignee_profile?.full_name ?? null,
  })) as Template[]
}

// Cached version for server components
export async function listTemplates(locationId: string, opts?: { active?: boolean; binderId?: string }) {
  const getCachedTemplates = unstable_cache(
    () => fetchTemplates(locationId, opts?.active, opts?.binderId),
    ["templates", locationId, String(opts?.active), String(opts?.binderId)],
    { revalidate: 60, tags: ["templates", `templates-${locationId}`] }
  )
  return getCachedTemplates()
}

export async function getTemplate(locationId: string, templateId: string) {
  const { data, error } = await supabase
    .from("inspection_templates")
    .select(`
      id, location_id, task, description, frequency,
      default_assignee_profile_id, default_assignee_email, default_due_rule,
      active, sort_order, created_by, updated_by, created_at, updated_at,
      binder_id, form_template_id,
      created_by_profile:profiles!inspection_templates_created_by_profile_fkey(full_name),
      updated_by_profile:profiles!inspection_templates_updated_by_profile_fkey(full_name)
    `)
    .eq("id", templateId)
    .eq("location_id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Template not found")

  const row = data as any
  return {
    id: row.id,
    location_id: row.location_id,
    task: row.task,
    description: row.description,
    frequency: row.frequency,
    default_assignee_profile_id: row.default_assignee_profile_id,
    default_assignee_email: row.default_assignee_email,
    default_due_rule: row.default_due_rule,
    active: row.active,
    sort_order: row.sort_order,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    binder_id: row.binder_id,
    form_template_id: row.form_template_id,
    created_by_name: row.created_by_profile?.full_name ?? null,
    updated_by_name: row.updated_by_profile?.full_name ?? null,
  } as Template
}

export async function createTemplate(locationId: string, userId: string, input: CreateTemplateInput) {
  // If email is provided, try to find matching profile
  let assigneeProfileId = input.default_assignee_profile_id
  if (input.default_assignee_email && !assigneeProfileId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", input.default_assignee_email)
      .single()
    if (profile) {
      assigneeProfileId = profile.id
    }
  }

  // Insert without JOINs to avoid issues with null updated_by
  const { data, error } = await supabase
    .from("inspection_templates")
    .insert({
      location_id: locationId,
      created_by: userId,
      ...input,
      default_assignee_profile_id: assigneeProfileId,
    })
    .select(`
      id, location_id, task, description, frequency,
      default_assignee_profile_id, default_assignee_email, default_due_rule,
      active, sort_order, created_by, updated_by, created_at, updated_at,
      binder_id, form_template_id
    `)
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  revalidateTemplatesCache(locationId)

  const row = data as any
  const template = {
    id: row.id,
    location_id: row.location_id,
    task: row.task,
    description: row.description,
    frequency: row.frequency,
    default_assignee_profile_id: row.default_assignee_profile_id,
    default_assignee_email: row.default_assignee_email,
    default_due_rule: row.default_due_rule,
    active: row.active,
    sort_order: row.sort_order,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    binder_id: row.binder_id,
    form_template_id: row.form_template_id,
    created_by_name: null, // Will be fetched on next list query
    updated_by_name: null,
  } as Template

  // Generate the first inspection instance automatically
  if (template.active) {
    try {
      const dueDate = calculateNextDueDate(template.frequency)
      await createInstance(locationId, userId, {
        template_id: template.id,
        due_at: dueDate.toISOString(),
        assigned_to_profile_id: template.default_assignee_profile_id ?? undefined,
        assigned_to_email: template.default_assignee_email ?? undefined,
      })
    } catch (instanceError) {
      console.error("Failed to create initial instance for template:", instanceError)
      // Don't throw - template was created successfully, instance creation can be retried by cron
    }
  }

  return template
}

export async function updateTemplate(locationId: string, templateId: string, userId: string, input: UpdateTemplateInput) {
  const updates: Record<string, unknown> = { ...input, updated_at: new Date().toISOString(), updated_by: userId }

  // If email is provided, try to find matching profile
  if (input.default_assignee_email !== undefined) {
    if (input.default_assignee_email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", input.default_assignee_email)
        .single()
      if (profile) {
        updates.default_assignee_profile_id = profile.id
      } else {
        // Clear profile if email doesn't match any registered user
        updates.default_assignee_profile_id = null
      }
    } else {
      // Clearing the email clears the profile too
      updates.default_assignee_profile_id = null
    }
  }

  const { data, error } = await supabase
    .from("inspection_templates")
    .update(updates)
    .eq("id", templateId)
    .eq("location_id", locationId)
    .select(`
      id, location_id, task, description, frequency,
      default_assignee_profile_id, default_assignee_email, default_due_rule,
      active, sort_order, created_by, updated_by, created_at, updated_at,
      binder_id, form_template_id,
      created_by_profile:profiles!inspection_templates_created_by_profile_fkey(full_name),
      updated_by_profile:profiles!inspection_templates_updated_by_profile_fkey(full_name)
    `)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Template not found")

  // If default assignee was updated, propagate to pending instances
  if (input.default_assignee_email !== undefined) {
    const newEmail = input.default_assignee_email || null
    const newProfileId = updates.default_assignee_profile_id as string | null

    // Update all pending instances for this template
    await supabase
      .from("inspection_instances")
      .update({
        assigned_to_email: newEmail,
        assigned_to_profile_id: newProfileId,
      })
      .eq("template_id", templateId)
      .eq("status", "pending")
  }

  revalidateTemplatesCache(locationId)

  const row = data as any
  return {
    id: row.id,
    location_id: row.location_id,
    task: row.task,
    description: row.description,
    frequency: row.frequency,
    default_assignee_profile_id: row.default_assignee_profile_id,
    default_assignee_email: row.default_assignee_email,
    default_due_rule: row.default_due_rule,
    active: row.active,
    sort_order: row.sort_order,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    binder_id: row.binder_id,
    form_template_id: row.form_template_id,
    created_by_name: row.created_by_profile?.full_name ?? null,
    updated_by_name: row.updated_by_profile?.full_name ?? null,
  } as Template
}

export async function reorderTemplates(
  locationId: string,
  frequency: string,
  orderedIds: string[]
) {
  // Update sort_order for each template in the new order
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("inspection_templates")
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("location_id", locationId)
      .eq("frequency", frequency)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    throw new ApiError("INTERNAL_ERROR", "Failed to reorder templates")
  }
}

export async function deleteTemplate(locationId: string, templateId: string, userId: string) {
  // Soft delete by setting active = false (preserves history for linked instances)
  const { error } = await supabase
    .from("inspection_templates")
    .update({ active: false, updated_at: new Date().toISOString(), updated_by: userId })
    .eq("id", templateId)
    .eq("location_id", locationId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  revalidateTemplatesCache(locationId)
}
