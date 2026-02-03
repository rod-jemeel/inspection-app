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
  template_description?: string | null
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
  // Computed fields from view
  is_overdue?: boolean
  signature_count?: number
  latest_signature_at?: string | null
  event_count?: number
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "void"],
  in_progress: ["failed", "passed", "void"],
  failed: ["in_progress"], // re-inspection
  passed: [], // terminal
  void: [], // terminal
}

async function fetchInstances(locationId: string, filters: InstanceFilters) {
  // Try to use the optimized view first, fallback to base table with JOIN
  let query = supabase
    .from("inspection_instances_detailed")
    .select("*")
    .eq("location_id", locationId)
    .order("due_at", { ascending: true })
    .limit(filters.limit)

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.from) query = query.gte("due_at", filters.from)
  if (filters.to) query = query.lte("due_at", filters.to)
  if (filters.assignee) query = query.eq("assigned_to_profile_id", filters.assignee)
  if (filters.cursor) query = query.gt("due_at", filters.cursor)

  const { data, error } = await query

  // Fallback to base table if view doesn't exist yet
  if (error?.code === "42P01") {
    // relation does not exist
    let fallbackQuery = supabase
      .from("inspection_instances")
      .select("*, inspection_templates(task, description, frequency)")
      .eq("location_id", locationId)
      .order("due_at", { ascending: true })
      .limit(filters.limit)

    if (filters.status) fallbackQuery = fallbackQuery.eq("status", filters.status)
    if (filters.from) fallbackQuery = fallbackQuery.gte("due_at", filters.from)
    if (filters.to) fallbackQuery = fallbackQuery.lte("due_at", filters.to)
    if (filters.assignee) fallbackQuery = fallbackQuery.eq("assigned_to_profile_id", filters.assignee)
    if (filters.cursor) fallbackQuery = fallbackQuery.gt("due_at", filters.cursor)

    const { data: fallbackData, error: fallbackError } = await fallbackQuery
    if (fallbackError) throw new ApiError("INTERNAL_ERROR", fallbackError.message)

    return (fallbackData ?? []).map((row: any) => ({
      ...row,
      template_task: row.inspection_templates?.task ?? null,
      template_description: row.inspection_templates?.description ?? null,
      template_frequency: row.inspection_templates?.frequency ?? null,
      inspection_templates: undefined,
    })) as Instance[]
  }

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return (data ?? []) as Instance[]
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
    .select("id, template_id, location_id, due_at, assigned_to_profile_id, assigned_to_email, status, remarks, inspected_at, failed_at, passed_at, created_by, created_at")
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

  // Handle assignment changes - if email is provided, try to resolve to profile
  if (input.assigned_to_email !== undefined) {
    updates.assigned_to_email = input.assigned_to_email
    // Try to find matching profile by email
    if (input.assigned_to_email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", input.assigned_to_email)
        .single()
      if (profile) {
        updates.assigned_to_profile_id = profile.id
      } else {
        // Clear profile_id if email doesn't match any profile (external inspector)
        updates.assigned_to_profile_id = null
      }
    } else {
      // Clearing assignment
      updates.assigned_to_profile_id = null
    }
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

/**
 * Calculate the next due date based on frequency
 * - Weekly: This Monday if not passed, otherwise next Monday
 * - Monthly: 1st of this month if not passed, otherwise 1st of next month
 * - Yearly: Jan 1st of this year if not passed, otherwise next year
 * - Every 3 years: Jan 1st, 3 years from last due or from now
 */
export function calculateNextDueDate(
  frequency: "weekly" | "monthly" | "yearly" | "every_3_years",
  fromDate?: Date
): Date {
  const now = fromDate ?? new Date()
  const result = new Date(now)
  result.setHours(0, 0, 0, 0)

  switch (frequency) {
    case "weekly": {
      // This Monday if today is Monday, otherwise next Monday
      const dayOfWeek = result.getDay() // 0 = Sunday, 1 = Monday
      if (dayOfWeek === 1) {
        // Today is Monday - use today
        break
      } else if (dayOfWeek === 0) {
        // Sunday - tomorrow is Monday
        result.setDate(result.getDate() + 1)
      } else {
        // Tuesday-Saturday - next Monday
        const daysUntilMonday = 8 - dayOfWeek
        result.setDate(result.getDate() + daysUntilMonday)
      }
      break
    }
    case "monthly": {
      // 1st of this month if today is the 1st, otherwise 1st of next month
      if (result.getDate() === 1) {
        // Today is the 1st - use today
        break
      }
      result.setMonth(result.getMonth() + 1)
      result.setDate(1)
      break
    }
    case "yearly": {
      // Jan 1st of this year if today is Jan 1st, otherwise next year
      if (result.getMonth() === 0 && result.getDate() === 1) {
        // Today is Jan 1st - use today
        break
      }
      result.setFullYear(result.getFullYear() + 1)
      result.setMonth(0)
      result.setDate(1)
      break
    }
    case "every_3_years": {
      // Jan 1st, 3 years from now (or from last completed)
      result.setFullYear(result.getFullYear() + 3)
      result.setMonth(0)
      result.setDate(1)
      break
    }
  }

  return result
}

/**
 * Check if an instance should receive a reminder based on frequency
 * Returns the reminder type or null if no reminder needed
 */
export function shouldSendReminder(
  dueAt: Date,
  frequency: "weekly" | "monthly" | "yearly" | "every_3_years"
): "due_today" | "upcoming" | "monthly_warning" | null {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const due = new Date(dueAt)
  due.setHours(0, 0, 0, 0)

  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  switch (frequency) {
    case "weekly":
      // Remind on the due day (Monday)
      if (daysUntilDue === 0) return "due_today"
      break

    case "monthly":
      // Remind 1 week before due
      if (daysUntilDue === 7) return "upcoming"
      if (daysUntilDue === 0) return "due_today"
      break

    case "yearly":
    case "every_3_years": {
      // Remind 6 months before, then every month until due
      const monthsUntilDue = Math.ceil(daysUntilDue / 30)
      if (monthsUntilDue === 6) return "upcoming" // 6 months warning
      if (monthsUntilDue <= 5 && monthsUntilDue >= 1) {
        // Check if it's the 1st of the month (monthly reminder)
        if (now.getDate() === 1) return "monthly_warning"
      }
      if (daysUntilDue === 0) return "due_today"
      break
    }
  }

  return null
}
