import "server-only"
import { unstable_cache, revalidateTag } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { CreateInstanceInput, UpdateInstanceInput, InstanceFilters } from "@/lib/validations/instance"

// Helper to revalidate instances cache
function revalidateInstancesCache() {
  revalidateTag("instances", "max")
}

export interface Instance {
  id: string
  template_id: string
  template_task?: string
  template_frequency?: "weekly" | "monthly" | "yearly" | "every_3_years" | null
  location_id: string
  due_at: string
  assigned_to_profile_id: string | null
  assigned_to_email: string | null
  status: "pending" | "in_progress" | "failed" | "passed" | "void"
  remarks: string | null
  inspected_at: string | null
  failed_at: string | null
  passed_at: string | null
  created_by: string
  created_at: string
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "void"],
  in_progress: ["failed", "passed", "void"],
  failed: ["in_progress"], // re-inspection
  passed: [], // terminal
  void: [], // terminal
}

async function fetchInstances(locationId: string, filters: InstanceFilters) {
  let query = supabase
    .from("inspection_instances")
    .select("*, inspection_templates(task, frequency)")
    .eq("location_id", locationId)
    .order("due_at", { ascending: true })
    .limit(filters.limit)

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.from) query = query.gte("due_at", filters.from)
  if (filters.to) query = query.lte("due_at", filters.to)
  if (filters.assignee) query = query.eq("assigned_to_profile_id", filters.assignee)
  if (filters.cursor) query = query.gt("due_at", filters.cursor)

  const { data, error } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  // Flatten the template task and frequency into the instance
  return (data ?? []).map((row: any) => ({
    ...row,
    template_task: row.inspection_templates?.task ?? null,
    template_frequency: row.inspection_templates?.frequency ?? null,
    inspection_templates: undefined,
  })) as Instance[]
}

// Cached version for server components - revalidates on instance mutations
export const listInstances = unstable_cache(
  fetchInstances,
  ["instances"],
  { revalidate: 30, tags: ["instances"] }
)

export async function getInstance(locationId: string, instanceId: string) {
  const { data, error } = await supabase
    .from("inspection_instances")
    .select("*")
    .eq("id", instanceId)
    .eq("location_id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Instance not found")
  return data as Instance
}

export async function createInstance(locationId: string, userId: string, input: CreateInstanceInput) {
  const { data, error } = await supabase
    .from("inspection_instances")
    .insert({
      location_id: locationId,
      created_by: userId,
      ...input,
    })
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  // Revalidate instances cache
  revalidateInstancesCache()

  return data as Instance
}

export async function updateInstance(locationId: string, instanceId: string, input: UpdateInstanceInput) {
  const current = await getInstance(locationId, instanceId)

  if (input.status) {
    const allowed = VALID_TRANSITIONS[current.status]
    if (!allowed?.includes(input.status)) {
      throw new ApiError("INVALID_TRANSITION", `Cannot transition from ${current.status} to ${input.status}`)
    }
  }

  const updates: Record<string, unknown> = { ...input }
  if (input.status === "failed") updates.failed_at = new Date().toISOString()
  if (input.status === "passed") updates.passed_at = new Date().toISOString()
  if (input.status === "in_progress" || input.status === "passed" || input.status === "failed") {
    updates.inspected_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("inspection_instances")
    .update(updates)
    .eq("id", instanceId)
    .eq("location_id", locationId)
    .select()
    .single()

  if (error || !data) throw new ApiError("INTERNAL_ERROR", error?.message ?? "Update failed")

  // Revalidate instances cache
  revalidateInstancesCache()

  return data as Instance
}
