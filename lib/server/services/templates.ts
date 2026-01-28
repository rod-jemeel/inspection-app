import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { CreateTemplateInput, UpdateTemplateInput } from "@/lib/validations/template"

export interface Template {
  id: string
  location_id: string
  task: string
  description: string | null
  frequency: "weekly" | "monthly" | "yearly" | "every_3_years"
  default_assignee_profile_id: string | null
  default_due_rule: Record<string, unknown> | null
  active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export async function listTemplates(locationId: string, opts?: { active?: boolean }) {
  let query = supabase
    .from("inspection_templates")
    .select("*")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })

  if (opts?.active !== undefined) {
    query = query.eq("active", opts.active)
  }

  const { data, error } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as Template[]
}

export async function getTemplate(locationId: string, templateId: string) {
  const { data, error } = await supabase
    .from("inspection_templates")
    .select("*")
    .eq("id", templateId)
    .eq("location_id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Template not found")
  return data as Template
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
  return data as Template
}

export async function updateTemplate(locationId: string, templateId: string, input: UpdateTemplateInput) {
  const { data, error } = await supabase
    .from("inspection_templates")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("location_id", locationId)
    .select()
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Template not found")
  return data as Template
}
