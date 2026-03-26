import "server-only";
import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { supabase } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import type {
  CreateBinderInput,
  UpdateBinderInput,
  UpdateBinderAssignmentsInput,
  UpdateProfileAssignmentsInput,
} from "@/lib/validations/binder";

// ============================================================================
// Instance Assignment Cascade
// ============================================================================

/**
 * When a single new user is assigned to a binder, auto-assign all unassigned
 * pending/in_progress instances within that binder to them.
 * Returns the count of auto-assigned instances.
 */
async function cascadeInstanceAssignments(
  binderId: string,
  newlyAssignedProfileIds: string[],
  actorProfileId: string,
): Promise<number> {
  // Only auto-assign when exactly 1 new user — avoids ambiguity
  if (newlyAssignedProfileIds.length !== 1) return 0;

  const profileId = newlyAssignedProfileIds[0];

  // Get all active form templates in this binder
  const { data: templates } = await supabase
    .from("form_templates")
    .select("id")
    .eq("binder_id", binderId)
    .eq("active", true);

  const templateIds = (templates ?? []).map((t: { id: string }) => t.id);
  if (templateIds.length === 0) return 0;

  // Find unassigned pending/in_progress instances for these templates
  const { data: unassignedInstances } = await supabase
    .from("inspection_instances")
    .select("id")
    .in("form_template_id", templateIds)
    .in("status", ["pending", "in_progress"])
    .is("assigned_to_profile_id", null);

  const instanceIds = (unassignedInstances ?? []).map((i: { id: string }) => i.id);
  if (instanceIds.length === 0) return 0;

  // Look up the user's email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profileId)
    .single();

  const email = profile?.email ?? null;

  // Batch-update all unassigned instances
  const { error: updateError } = await supabase
    .from("inspection_instances")
    .update({
      assigned_to_profile_id: profileId,
      assigned_to_email: email,
    })
    .in("id", instanceIds);

  if (updateError) {
    console.error("[cascadeInstanceAssignments] Failed to update instances:", updateError);
    return 0;
  }

  // Batch-insert assignment events
  const eventRows = instanceIds.map((instanceId: string) => ({
    inspection_instance_id: instanceId,
    event_type: "assigned",
    actor_profile_id: actorProfileId,
    payload: {
      source: "binder_assignment_cascade",
      assigned_to_profile_id: profileId,
      assigned_to_email: email,
    },
  }));

  const { error: eventError } = await supabase
    .from("inspection_events")
    .insert(eventRows);

  if (eventError) {
    console.error("[cascadeInstanceAssignments] Failed to log events:", eventError);
  }

  // Bust the instances cache
  revalidateTag("instances", "max");

  return instanceIds.length;
}

function revalidateBindersCache(locationId: string) {
  revalidateTag("binders", "max");
  revalidateTag(`binders-${locationId}`, "max");
}

export interface Binder {
  id: string;
  location_id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  active: boolean;
  show_in_nav: boolean;
  created_at: string;
  updated_at: string;
  created_by_profile_id: string | null;
  form_count?: number;
}

export interface BinderAssignment {
  id: string;
  binder_id: string;
  profile_id: string;
  can_edit: boolean;
  assigned_at: string;
  assigned_by_profile_id: string | null;
}

async function fetchBinders(locationId: string, active?: boolean) {
  let query = supabase
    .from("binders")
    .select("*")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (active !== undefined) {
    query = query.eq("active", active);
  }

  const { data, error } = await query;
  if (error) throw new ApiError("INTERNAL_ERROR", error.message);

  // Get form counts for each binder
  const binders = data ?? [];
  if (binders.length === 0) return [] as Binder[];

  const binderIds = binders.map((b: { id: string }) => b.id);
  const { data: formCounts, error: countError } = await supabase
    .from("form_templates")
    .select("binder_id")
    .in("binder_id", binderIds)
    .eq("active", true);

  if (countError) throw new ApiError("INTERNAL_ERROR", countError.message);

  const countMap: Record<string, number> = {};
  for (const row of formCounts ?? []) {
    countMap[row.binder_id] = (countMap[row.binder_id] || 0) + 1;
  }

  return binders.map((b: Record<string, unknown>) => ({
    ...b,
    form_count: countMap[b.id as string] || 0,
  })) as Binder[];
}

export async function listBinders(
  locationId: string,
  opts?: { active?: boolean },
) {
  const getCachedBinders = unstable_cache(
    () => fetchBinders(locationId, opts?.active),
    ["binders", locationId, String(opts?.active)],
    { revalidate: 60, tags: ["binders", `binders-${locationId}`] },
  );
  return getCachedBinders();
}

export const getBinder = cache(async (locationId: string, binderId: string) => {
  const { data, error } = await supabase
    .from("binders")
    .select("*")
    .eq("id", binderId)
    .eq("location_id", locationId)
    .single();

  if (error || !data) throw new ApiError("NOT_FOUND", "Binder not found");
  return data as Binder;
})

export async function createBinder(
  locationId: string,
  profileId: string,
  input: CreateBinderInput,
) {
  const { data, error } = await supabase
    .from("binders")
    .insert({
      location_id: locationId,
      created_by_profile_id: profileId,
      ...input,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(
        "VALIDATION_ERROR",
        `A binder named "${input.name}" already exists at this location`,
      );
    }
    throw new ApiError("INTERNAL_ERROR", error.message);
  }

  revalidateBindersCache(locationId);
  return { ...data, form_count: 0 } as Binder;
}

export async function updateBinder(
  locationId: string,
  binderId: string,
  input: UpdateBinderInput,
) {
  const { data, error } = await supabase
    .from("binders")
    .update(input)
    .eq("id", binderId)
    .eq("location_id", locationId)
    .select()
    .single();

  if (error || !data) throw new ApiError("NOT_FOUND", "Binder not found");

  revalidateBindersCache(locationId);
  return data as Binder;
}

export async function deleteBinder(locationId: string, binderId: string) {
  // Soft delete by setting active = false
  const { error } = await supabase
    .from("binders")
    .update({ active: false })
    .eq("id", binderId)
    .eq("location_id", locationId);

  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  revalidateBindersCache(locationId);
}

// ============================================================================
// Binder Assignments
// ============================================================================

export async function getBinderAssignments(binderId: string) {
  const { data, error } = await supabase
    .from("binder_assignments")
    .select(
      "id, binder_id, profile_id, can_edit, assigned_at, assigned_by_profile_id",
    )
    .eq("binder_id", binderId)
    .order("assigned_at", { ascending: true });

  if (error) throw new ApiError("INTERNAL_ERROR", error.message);
  return (data ?? []) as BinderAssignment[];
}

export async function getMemberBinderAssignments(profileId: string) {
  const { data, error } = await supabase
    .from("binder_assignments")
    .select(
      `
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
    `,
    )
    .eq("profile_id", profileId)
    .order("assigned_at", { ascending: true });

  if (error) throw new ApiError("INTERNAL_ERROR", error.message);

  type AssignmentRow = {
    binder_id: string;
    can_edit: boolean;
    binders: { id: string; name: string; color: string | null }[] | null;
  };

  return ((data ?? []) as AssignmentRow[]).map((assignment) => {
    const binder = assignment.binders?.[0] ?? null;

    return {
      binder_id: assignment.binder_id,
      binder_name: binder?.name ?? "Unknown Binder",
      binder_color: binder?.color || "#6b7280",
      access_level: assignment.can_edit ? "editor" : "viewer",
    };
  });
}

export async function updateBinderAssignments(
  binderId: string,
  input: UpdateBinderAssignmentsInput,
  assignedByProfileId: string,
) {
  // Snapshot previous assignments to detect newly added users
  const previousAssignments = await getBinderAssignments(binderId);
  const previousProfileIds = new Set(previousAssignments.map((a) => a.profile_id));

  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from("binder_assignments")
    .delete()
    .eq("binder_id", binderId);

  if (deleteError) throw new ApiError("INTERNAL_ERROR", deleteError.message);

  // Insert new assignments
  if (input.assignments.length > 0) {
    const rows = input.assignments.map((a) => ({
      binder_id: binderId,
      profile_id: a.profile_id,
      can_edit: a.can_edit,
      assigned_by_profile_id: assignedByProfileId,
    }));

    const { error: insertError } = await supabase
      .from("binder_assignments")
      .insert(rows);

    if (insertError) throw new ApiError("INTERNAL_ERROR", insertError.message);
  }

  // Determine newly assigned profile IDs and cascade instance assignments
  const newlyAssignedProfileIds = input.assignments
    .map((a) => a.profile_id)
    .filter((id) => !previousProfileIds.has(id));

  const autoAssignedCount = await cascadeInstanceAssignments(
    binderId,
    newlyAssignedProfileIds,
    assignedByProfileId,
  );

  const assignments = await getBinderAssignments(binderId);
  return { assignments, autoAssignedCount };
}

/**
 * Check if a user has edit permission for a specific binder.
 * Owner/admin always have edit rights. Others need can_edit=true on their assignment.
 */
export async function canUserEditBinder(
  profileId: string,
  binderId: string,
  role: string,
  opts?: {
    can_manage_binders?: boolean;
    can_manage_forms?: boolean;
  },
): Promise<boolean> {
  if (
    ["owner", "admin"].includes(role) ||
    opts?.can_manage_binders ||
    opts?.can_manage_forms
  ) {
    return true;
  }

  const { data } = await supabase
    .from("binder_assignments")
    .select("can_edit")
    .eq("binder_id", binderId)
    .eq("profile_id", profileId)
    .single();

  return data?.can_edit === true;
}

/**
 * Get binders visible to a specific user based on their role.
 * Owner/admin see all binders.
 * Other roles only see binders they're assigned to.
 */
export async function getBindersForUser(
  locationId: string,
  profileId: string,
  role: string,
  opts?: {
    can_manage_binders?: boolean;
    can_manage_forms?: boolean;
  },
) {
  // Management roles see all binders
  if (
    ["owner", "admin"].includes(role) ||
    opts?.can_manage_binders ||
    opts?.can_manage_forms
  ) {
    return listBinders(locationId, { active: true });
  }

  // Other roles only see assigned binders
  const { data: assignments, error } = await supabase
    .from("binder_assignments")
    .select("binder_id")
    .eq("profile_id", profileId);

  if (error) throw new ApiError("INTERNAL_ERROR", error.message);

  if (!assignments || assignments.length === 0) return [] as Binder[];

  const binderIds = assignments.map((a: { binder_id: string }) => a.binder_id);
  const { data: binders, error: binderError } = await supabase
    .from("binders")
    .select("*")
    .in("id", binderIds)
    .eq("location_id", locationId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (binderError) throw new ApiError("INTERNAL_ERROR", binderError.message);

  // Add form counts
  const assignedBinders = binders ?? [];
  if (assignedBinders.length === 0) return [] as Binder[];

  const ids = assignedBinders.map((b: { id: string }) => b.id);
  const { data: formCounts } = await supabase
    .from("form_templates")
    .select("binder_id")
    .in("binder_id", ids)
    .eq("active", true);

  const countMap: Record<string, number> = {};
  for (const row of formCounts ?? []) {
    countMap[row.binder_id] = (countMap[row.binder_id] || 0) + 1;
  }

  return assignedBinders.map((b: Record<string, unknown>) => ({
    ...b,
    form_count: countMap[b.id as string] || 0,
  })) as Binder[];
}

export async function updateProfileAssignments(
  locationId: string,
  profileId: string,
  input: UpdateProfileAssignmentsInput,
  assignedByProfileId: string,
) {
  // Get all binder IDs in this location so we only delete assignments scoped to it
  const { data: locationBinders, error: bindersError } = await supabase
    .from("binders")
    .select("id")
    .eq("location_id", locationId);

  if (bindersError) throw new ApiError("INTERNAL_ERROR", bindersError.message);

  const locationBinderIds = (locationBinders ?? []).map((b: { id: string }) => b.id);

  // Snapshot previous assignments to detect newly added binders
  const previousBinderIds = new Set<string>();
  if (locationBinderIds.length > 0) {
    const { data: prevAssignments } = await supabase
      .from("binder_assignments")
      .select("binder_id")
      .eq("profile_id", profileId)
      .in("binder_id", locationBinderIds);
    for (const a of prevAssignments ?? []) {
      previousBinderIds.add(a.binder_id);
    }

    const { error: deleteError } = await supabase
      .from("binder_assignments")
      .delete()
      .eq("profile_id", profileId)
      .in("binder_id", locationBinderIds);

    if (deleteError) throw new ApiError("INTERNAL_ERROR", deleteError.message);
  }

  if (input.assignments.length > 0) {
    const rows = input.assignments.map((a) => ({
      binder_id: a.binder_id,
      profile_id: profileId,
      can_edit: a.can_edit,
      assigned_by_profile_id: assignedByProfileId,
    }));

    const { error: insertError } = await supabase
      .from("binder_assignments")
      .insert(rows);

    if (insertError) throw new ApiError("INTERNAL_ERROR", insertError.message);
  }

  // Cascade instance assignments for each newly assigned binder
  const newlyAssignedBinderIds = input.assignments
    .map((a) => a.binder_id)
    .filter((id) => !previousBinderIds.has(id));

  let autoAssignedCount = 0;
  for (const binderId of newlyAssignedBinderIds) {
    autoAssignedCount += await cascadeInstanceAssignments(
      binderId,
      [profileId],
      assignedByProfileId,
    );
  }

  const assignments = await getAssignmentsForProfile(locationId, profileId);
  return { assignments, autoAssignedCount };
}

export async function getAssignmentsForProfile(
  locationId: string,
  profileId: string,
): Promise<
  {
    binder_id: string;
    binder_name: string;
    binder_color: string | null;
    can_edit: boolean;
  }[]
> {
  const { data, error } = await supabase
    .from("binder_assignments")
    .select(
      `
      binder_id,
      can_edit,
      binders (name, color)
    `,
    )
    .eq("profile_id", profileId);

  if (error) throw new ApiError("INTERNAL_ERROR", error.message);

  type AssignmentRow = {
    binder_id: string;
    can_edit: boolean;
    binders: { name: string; color: string | null }[] | null;
  };

  return ((data ?? []) as AssignmentRow[])
    .map((row) => {
      const binder = row.binders?.[0];
      if (!binder) return null;

      return {
        binder_id: row.binder_id,
        binder_name: binder.name,
        binder_color: binder.color,
        can_edit: row.can_edit,
      };
    })
    .filter(
      (
        row,
      ): row is {
        binder_id: string;
        binder_name: string;
        binder_color: string | null;
        can_edit: boolean;
      } => row !== null,
    );
}
