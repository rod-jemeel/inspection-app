import "server-only"
import { unstable_cache, revalidateTag } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { CreateTemplateInput, UpdateTemplateInput } from "@/lib/validations/template"

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
  default_due_rule: Record<string, unknown> | null
  active: boolean
  sort_order: number
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
  created_by_name?: string | null
  updated_by_name?: string | null
}

// Helper to enrich templates with user names
async function enrichWithUserNames(templates: Template[]): Promise<Template[]> {
  const userIds = new Set<string>()
  for (const t of templates) {
    if (t.created_by) userIds.add(t.created_by)
    if (t.updated_by) userIds.add(t.updated_by)
  }

  if (userIds.size === 0) return templates

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", Array.from(userIds))

  const nameMap = new Map<string, string>()
  for (const p of profiles ?? []) {
    nameMap.set(p.user_id, p.full_name)
  }

  return templates.map((t) => ({
    ...t,
    created_by_name: t.created_by ? nameMap.get(t.created_by) ?? null : null,
    updated_by_name: t.updated_by ? nameMap.get(t.updated_by) ?? null : null,
  }))
}

async function fetchTemplates(locationId: string, active?: boolean) {
  let query = supabase
    .from("inspection_templates")
    .select("*")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (active !== undefined) {
    query = query.eq("active", active)
  }

  const { data, error } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return enrichWithUserNames(data as Template[])
}

// Cached version for server components
export async function listTemplates(locationId: string, opts?: { active?: boolean }) {
  const getCachedTemplates = unstable_cache(
    () => fetchTemplates(locationId, opts?.active),
    ["templates", locationId, String(opts?.active)],
    { revalidate: 60, tags: ["templates", `templates-${locationId}`] }
  )
  return getCachedTemplates()
}

export async function getTemplate(locationId: string, templateId: string) {
  const { data, error } = await supabase
    .from("inspection_templates")
    .select("*")
    .eq("id", templateId)
    .eq("location_id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Template not found")
  const [enriched] = await enrichWithUserNames([data as Template])
  return enriched
}

export async function createTemplate(locationId: string, userId: string, input: CreateTemplateInput) {
  const { data, error } = await supabase
    .from("inspection_templates")
    .insert({
      location_id: locationId,
      created_by: userId,
      ...input,
    })
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  revalidateTemplatesCache(locationId)

  const [enriched] = await enrichWithUserNames([data as Template])
  return enriched
}

export async function updateTemplate(locationId: string, templateId: string, userId: string, input: UpdateTemplateInput) {
  const { data, error } = await supabase
    .from("inspection_templates")
    .update({ ...input, updated_at: new Date().toISOString(), updated_by: userId })
    .eq("id", templateId)
    .eq("location_id", locationId)
    .select()
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Template not found")

  revalidateTemplatesCache(locationId)

  const [enriched] = await enrichWithUserNames([data as Template])
  return enriched
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
