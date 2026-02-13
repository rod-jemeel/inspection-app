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
  template_frequency?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years" | null
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
  assignee_name?: string | null
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "void"],
  in_progress: ["failed", "passed", "void"],
  failed: ["in_progress"], // re-inspection
  passed: [], // terminal
  void: [], // terminal
}

async function fetchInstances(locationId: string, filters: InstanceFilters) {
  // If binder_id filter is set, we need to find template IDs in that binder first
  let templateIdsInBinder: string[] | null = null
  if (filters.binder_id) {
    const { data: tplRows } = await supabase
      .from("inspection_templates")
      .select("id")
      .eq("location_id", locationId)
      .eq("binder_id", filters.binder_id)
    templateIdsInBinder = (tplRows ?? []).map((r: any) => r.id)
    if (templateIdsInBinder.length === 0) return []
  }

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
  if (templateIdsInBinder) query = query.in("template_id", templateIdsInBinder)

  const { data, error } = await query

  // Fallback to base table if view doesn't exist yet
  if (error?.code === "42P01") {
    // relation does not exist
    let fallbackQuery = supabase
      .from("inspection_instances")
      .select("*, inspection_templates(task, description, frequency), assignee_profile:profiles!inspection_instances_assigned_to_profile_id_fkey(full_name)")
      .eq("location_id", locationId)
      .order("due_at", { ascending: true })
      .limit(filters.limit)

    if (filters.status) fallbackQuery = fallbackQuery.eq("status", filters.status)
    if (filters.from) fallbackQuery = fallbackQuery.gte("due_at", filters.from)
    if (filters.to) fallbackQuery = fallbackQuery.lte("due_at", filters.to)
    if (filters.assignee) fallbackQuery = fallbackQuery.eq("assigned_to_profile_id", filters.assignee)
    if (filters.cursor) fallbackQuery = fallbackQuery.gt("due_at", filters.cursor)
    if (templateIdsInBinder) fallbackQuery = fallbackQuery.in("template_id", templateIdsInBinder)

    const { data: fallbackData, error: fallbackError } = await fallbackQuery
    if (fallbackError) throw new ApiError("INTERNAL_ERROR", fallbackError.message)

    return (fallbackData ?? []).map((row: any) => ({
      ...row,
      template_task: row.inspection_templates?.task ?? null,
      template_description: row.inspection_templates?.description ?? null,
      template_frequency: row.inspection_templates?.frequency ?? null,
      assignee_name: row.assignee_profile?.full_name ?? null,
      inspection_templates: undefined,
      assignee_profile: undefined,
    })) as Instance[]
  }

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  // For view data, we need to fetch assignee names separately if any instances have assigned_to_profile_id
  const instances = (data ?? []) as Instance[]

  // Get unique profile IDs that need names
  const profileIds = [...new Set(instances.map(i => i.assigned_to_profile_id).filter(Boolean))] as string[]

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds)

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

    // Add assignee names to instances
    return instances.map(instance => ({
      ...instance,
      assignee_name: instance.assigned_to_profile_id ? profileMap.get(instance.assigned_to_profile_id) ?? null : null,
    }))
  }

  return instances
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
export interface DueRule {
  dayOfWeek?: number  // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  dayOfMonth?: number // 1-31
  month?: number      // 1-12
}

export function calculateNextDueDate(
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years",
  fromDate?: Date,
  dueRule?: DueRule | null
): Date {
  const now = fromDate ?? new Date()
  const result = new Date(now)
  result.setHours(0, 0, 0, 0)

  switch (frequency) {
    case "daily": {
      // Tomorrow (next day from now)
      result.setDate(result.getDate() + 1)
      break
    }
    case "weekly": {
      // Use due rule's dayOfWeek if set, otherwise default to Monday (1)
      const targetDay = dueRule?.dayOfWeek ?? 1
      const currentDay = result.getDay()
      if (currentDay === targetDay) {
        // Today is the target day - use today
        break
      }
      // Calculate days until target day
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7
      result.setDate(result.getDate() + daysUntil)
      break
    }
    case "monthly": {
      // Use due rule's dayOfMonth if set, otherwise default to 1st
      const targetDayOfMonth = dueRule?.dayOfMonth ?? 1
      if (result.getDate() === targetDayOfMonth) {
        break
      }
      if (result.getDate() < targetDayOfMonth) {
        result.setDate(targetDayOfMonth)
      } else {
        result.setMonth(result.getMonth() + 1)
        result.setDate(targetDayOfMonth)
      }
      break
    }
    case "quarterly": {
      // 1st of next quarter (Jan, Apr, Jul, Oct), or due rule dayOfMonth
      const targetDay = dueRule?.dayOfMonth ?? 1
      const currentMonth = result.getMonth()
      const nextQuarterMonth = Math.floor(currentMonth / 3) * 3 + 3
      if (nextQuarterMonth > 11) {
        result.setFullYear(result.getFullYear() + 1)
        result.setMonth(0)
      } else {
        result.setMonth(nextQuarterMonth)
      }
      result.setDate(targetDay)
      break
    }
    case "yearly": {
      // Use due rule's month and dayOfMonth, default to Jan 1
      const targetMonth = (dueRule?.month ?? 1) - 1 // Convert 1-indexed to 0-indexed
      const targetDay = dueRule?.dayOfMonth ?? 1
      if (result.getMonth() === targetMonth && result.getDate() === targetDay) {
        break
      }
      // If we haven't passed the target date this year, use this year
      const targetThisYear = new Date(result.getFullYear(), targetMonth, targetDay)
      if (targetThisYear > result) {
        result.setMonth(targetMonth)
        result.setDate(targetDay)
      } else {
        result.setFullYear(result.getFullYear() + 1)
        result.setMonth(targetMonth)
        result.setDate(targetDay)
      }
      break
    }
    case "every_3_years": {
      // Same as yearly but +3 years
      const targetMonth = (dueRule?.month ?? 1) - 1
      const targetDay = dueRule?.dayOfMonth ?? 1
      result.setFullYear(result.getFullYear() + 3)
      result.setMonth(targetMonth)
      result.setDate(targetDay)
      break
    }
  }

  return result
}

/**
 * Reminder settings type for shouldSendReminder
 */
export interface ReminderConfig {
  weekly_due_day: boolean
  monthly_days_before: number
  monthly_due_day: boolean
  yearly_months_before: number
  yearly_monthly_reminder: boolean
  yearly_due_day: boolean
  three_year_months_before: number
  three_year_monthly_reminder: boolean
  three_year_due_day: boolean
}

/**
 * Default reminder settings (used if no config provided)
 */
const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  weekly_due_day: true,
  monthly_days_before: 7,
  monthly_due_day: true,
  yearly_months_before: 6,
  yearly_monthly_reminder: true,
  yearly_due_day: true,
  three_year_months_before: 6,
  three_year_monthly_reminder: true,
  three_year_due_day: true,
}

/**
 * Check if an instance should receive a reminder based on frequency and settings
 * Returns the reminder type or null if no reminder needed
 */
export function shouldSendReminder(
  dueAt: Date,
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years",
  config: ReminderConfig = DEFAULT_REMINDER_CONFIG
): "due_today" | "upcoming" | "monthly_warning" | null {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const due = new Date(dueAt)
  due.setHours(0, 0, 0, 0)

  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  switch (frequency) {
    case "daily":
      // Daily inspections - always remind on due day
      if (daysUntilDue === 0) return "due_today"
      break

    case "weekly":
      // Weekly inspections are due on Monday - remind on due day if enabled
      if (daysUntilDue === 0 && config.weekly_due_day) return "due_today"
      break

    case "monthly":
      // Remind X days before due (configurable)
      if (daysUntilDue === config.monthly_days_before) return "upcoming"
      // Remind on due day if enabled
      if (daysUntilDue === 0 && config.monthly_due_day) return "due_today"
      break

    case "quarterly":
      // Same as monthly - remind X days before and on due day
      if (daysUntilDue === config.monthly_days_before) return "upcoming"
      if (daysUntilDue === 0 && config.monthly_due_day) return "due_today"
      break

    case "yearly": {
      // Remind X months before, then monthly reminders if enabled
      const monthsUntilDue = Math.ceil(daysUntilDue / 30)
      if (monthsUntilDue === config.yearly_months_before) return "upcoming"
      if (monthsUntilDue < config.yearly_months_before && monthsUntilDue >= 1) {
        // Monthly reminder on 1st of month if enabled
        if (config.yearly_monthly_reminder && now.getDate() === 1) return "monthly_warning"
      }
      if (daysUntilDue === 0 && config.yearly_due_day) return "due_today"
      break
    }

    case "every_3_years": {
      // Same pattern as yearly but with 3-year settings
      const monthsUntilDue = Math.ceil(daysUntilDue / 30)
      if (monthsUntilDue === config.three_year_months_before) return "upcoming"
      if (monthsUntilDue < config.three_year_months_before && monthsUntilDue >= 1) {
        // Monthly reminder on 1st of month if enabled
        if (config.three_year_monthly_reminder && now.getDate() === 1) return "monthly_warning"
      }
      if (daysUntilDue === 0 && config.three_year_due_day) return "due_today"
      break
    }
  }

  return null
}
