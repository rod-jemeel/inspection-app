import "server-only"
import { unstable_cache, revalidateTag } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { CreateBinderInput, UpdateBinderInput, UpdateBinderAssignmentsInput } from "@/lib/validations/binder"

function revalidateBindersCache(locationId: string) {
  revalidateTag("binders", "max")
  revalidateTag(`binders-${locationId}`, "max")
}

export interface Binder {
  id: string
  location_id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
  created_by_profile_id: string | null
  form_count?: number
}

export interface BinderAssignment {
  id: string
  binder_id: string
  profile_id: string
  can_edit: boolean
  assigned_at: string
  assigned_by_profile_id: string | null
}

async function fetchBinders(locationId: string, active?: boolean) {
  let query = supabase
    .from("binders")
    .select("*")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (active !== undefined) {
    query = query.eq("active", active)
  }

  const { data, error } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  // Get form counts for each binder
  const binders = data ?? []
  if (binders.length === 0) return [] as Binder[]

  const binderIds = binders.map((b: { id: string }) => b.id)
  const { data: formCounts, error: countError } = await supabase
    .from("form_templates")
    .select("binder_id")
    .in("binder_id", binderIds)
    .eq("active", true)

  if (countError) throw new ApiError("INTERNAL_ERROR", countError.message)

  const countMap: Record<string, number> = {}
  for (const row of formCounts ?? []) {
    countMap[row.binder_id] = (countMap[row.binder_id] || 0) + 1
  }

  return binders.map((b: Record<string, unknown>) => ({
    ...b,
    form_count: countMap[b.id as string] || 0,
  })) as Binder[]
}

export async function listBinders(locationId: string, opts?: { active?: boolean }) {
  const getCachedBinders = unstable_cache(
    () => fetchBinders(locationId, opts?.active),
    ["binders", locationId, String(opts?.active)],
    { revalidate: 60, tags: ["binders", `binders-${locationId}`] }
  )
  return getCachedBinders()
}

export async function getBinder(locationId: string, binderId: string) {
  const { data, error } = await supabase
    .from("binders")
    .select("*")
    .eq("id", binderId)
    .eq("location_id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Binder not found")
  return data as Binder
}

export async function createBinder(locationId: string, profileId: string, input: CreateBinderInput) {
  const { data, error } = await supabase
    .from("binders")
    .insert({
      location_id: locationId,
      created_by_profile_id: profileId,
      ...input,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new ApiError("VALIDATION_ERROR", `A binder named "${input.name}" already exists at this location`)
    }
    throw new ApiError("INTERNAL_ERROR", error.message)
  }

  revalidateBindersCache(locationId)
  return { ...data, form_count: 0 } as Binder
}

export async function updateBinder(locationId: string, binderId: string, input: UpdateBinderInput) {
  const { data, error } = await supabase
    .from("binders")
    .update(input)
    .eq("id", binderId)
    .eq("location_id", locationId)
    .select()
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Binder not found")

  revalidateBindersCache(locationId)
  return data as Binder
}

export async function deleteBinder(locationId: string, binderId: string) {
  // Soft delete by setting active = false
  const { error } = await supabase
    .from("binders")
    .update({ active: false })
    .eq("id", binderId)
    .eq("location_id", locationId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  revalidateBindersCache(locationId)
}

// ============================================================================
// Binder Assignments
// ============================================================================

export async function getBinderAssignments(binderId: string) {
  const { data, error } = await supabase
    .from("binder_assignments")
    .select("id, binder_id, profile_id, can_edit, assigned_at, assigned_by_profile_id")
    .eq("binder_id", binderId)
    .order("assigned_at", { ascending: true })

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return (data ?? []) as BinderAssignment[]
}

export async function getMemberBinderAssignments(profileId: string) {
  const { data, error } = await supabase
    .from("binder_assignments")
    .select(`
      id,
      binder_id,
      profile_id,
      can_edit,
      assigned_at,
      binders!inner (
        id,
        name,
        color
      )
    `)
    .eq("profile_id", profileId)
    .order("assigned_at", { ascending: true })

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  return (data ?? []).map((assignment: any) => ({
    binder_id: assignment.binder_id,
    binder_name: assignment.binders.name,
    binder_color: assignment.binders.color || "#6b7280",
    access_level: assignment.can_edit ? "editor" : "viewer",
  }))
}

export async function updateBinderAssignments(
  binderId: string,
  input: UpdateBinderAssignmentsInput,
  assignedByProfileId: string
) {
  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from("binder_assignments")
    .delete()
    .eq("binder_id", binderId)

  if (deleteError) throw new ApiError("INTERNAL_ERROR", deleteError.message)

  // Insert new assignments
  if (input.assignments.length > 0) {
    const rows = input.assignments.map((a) => ({
      binder_id: binderId,
      profile_id: a.profile_id,
      can_edit: a.can_edit,
      assigned_by_profile_id: assignedByProfileId,
    }))

    const { error: insertError } = await supabase
      .from("binder_assignments")
      .insert(rows)

    if (insertError) throw new ApiError("INTERNAL_ERROR", insertError.message)
  }

  return getBinderAssignments(binderId)
}

/**
 * Check if a user has edit permission for a specific binder.
 * Owner/admin always have edit rights. Others need can_edit=true on their assignment.
 */
export async function canUserEditBinder(
  profileId: string,
  binderId: string,
  role: string
): Promise<boolean> {
  if (["owner", "admin"].includes(role)) return true

  const { data } = await supabase
    .from("binder_assignments")
    .select("can_edit")
    .eq("binder_id", binderId)
    .eq("profile_id", profileId)
    .single()

  return data?.can_edit === true
}

/**
 * Get binders visible to a specific user based on their role.
 * Owner/admin see all binders.
 * Other roles only see binders they're assigned to.
 */
export async function getBindersForUser(
  locationId: string,
  profileId: string,
  role: string
) {
  // Management roles see all binders
  if (["owner", "admin"].includes(role)) {
    return listBinders(locationId, { active: true })
  }

  // Other roles only see assigned binders
  const { data: assignments, error } = await supabase
    .from("binder_assignments")
    .select("binder_id")
    .eq("profile_id", profileId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  if (!assignments || assignments.length === 0) return [] as Binder[]

  const binderIds = assignments.map((a: { binder_id: string }) => a.binder_id)
  const { data: binders, error: binderError } = await supabase
    .from("binders")
    .select("*")
    .in("id", binderIds)
    .eq("location_id", locationId)
    .eq("active", true)
    .order("sort_order", { ascending: true })

  if (binderError) throw new ApiError("INTERNAL_ERROR", binderError.message)

  // Add form counts
  const assignedBinders = binders ?? []
  if (assignedBinders.length === 0) return [] as Binder[]

  const ids = assignedBinders.map((b: { id: string }) => b.id)
  const { data: formCounts } = await supabase
    .from("form_templates")
    .select("binder_id")
    .in("binder_id", ids)
    .eq("active", true)

  const countMap: Record<string, number> = {}
  for (const row of formCounts ?? []) {
    countMap[row.binder_id] = (countMap[row.binder_id] || 0) + 1
  }

  return assignedBinders.map((b: Record<string, unknown>) => ({
    ...b,
    form_count: countMap[b.id as string] || 0,
  })) as Binder[]
}

export async function getAssignmentsForProfile(
  locationId: string,
  profileId: string
): Promise<{ binder_id: string; binder_name: string; binder_color: string | null; can_edit: boolean }[]> {
  const { data, error } = await supabase
    .from("binder_assignments")
    .select(`
      binder_id,
      can_edit,
      binders (name, color)
    `)
    .eq("profile_id", profileId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  return (data ?? [])
    .filter((row: any) => row.binders)
    .map((row: any) => ({
      binder_id: row.binder_id,
      binder_name: row.binders.name,
      binder_color: row.binders.color,
      can_edit: row.can_edit,
    }))
}
