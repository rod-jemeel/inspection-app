import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { UpdateLocationInput } from "@/lib/validations/location"
import type { Role } from "@/lib/permissions"

export interface Location {
  id: string
  name: string
  address: string | null
  timezone: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  user_id: string
  full_name: string
  email: string | null
  username: string | null
  role: Role
  created_at: string
  can_manage_binders: boolean
  can_manage_forms: boolean
  can_view_all_responses: boolean
  can_export_reports: boolean
  can_configure_integrations: boolean
  signature_image: string | null
  default_initials: string | null
}

export async function getLocation(locationId: string): Promise<Location> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, address, timezone, active, created_at, updated_at")
    .eq("id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Location not found")
  return data as Location
}

export async function updateLocation(
  locationId: string,
  input: UpdateLocationInput
): Promise<Location> {
  const { data, error } = await supabase
    .from("locations")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", locationId)
    .select()
    .single()

  if (error || !data) throw new ApiError("INTERNAL_ERROR", error?.message ?? "Update failed")
  return data as Location
}

export async function getTeamMembers(locationId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("profile_locations")
    .select(`
      profiles (
        id,
        user_id,
        full_name,
        email,
        username,
        role,
        created_at,
        can_manage_binders,
        can_manage_forms,
        can_view_all_responses,
        can_export_reports,
        can_configure_integrations,
        signature_image,
        default_initials
      )
    `)
    .eq("location_id", locationId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  return (data ?? []).map((row: any) => ({
    id: row.profiles.id,
    user_id: row.profiles.user_id,
    full_name: row.profiles.full_name,
    email: row.profiles.email,
    username: row.profiles.username,
    role: row.profiles.role,
    created_at: row.profiles.created_at,
    can_manage_binders: row.profiles.can_manage_binders ?? false,
    can_manage_forms: row.profiles.can_manage_forms ?? false,
    can_view_all_responses: row.profiles.can_view_all_responses ?? false,
    can_export_reports: row.profiles.can_export_reports ?? false,
    can_configure_integrations: row.profiles.can_configure_integrations ?? false,
    signature_image: row.profiles.signature_image,
    default_initials: row.profiles.default_initials,
  }))
}

export async function updateMemberRole(
  locationId: string,
  profileId: string,
  newRole: "admin" | "nurse" | "inspector"
): Promise<void> {
  // Verify the member is actually in this location
  const { data: link } = await supabase
    .from("profile_locations")
    .select("profile_id")
    .eq("location_id", locationId)
    .eq("profile_id", profileId)
    .single()

  if (!link) throw new ApiError("NOT_FOUND", "Member not found in this location")

  // Check if this is the owner - can't change owner role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .single()

  if (profile?.role === "owner") {
    throw new ApiError("FORBIDDEN", "Cannot change owner role")
  }

  // Update the role
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", profileId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
}

export async function removeMemberFromLocation(
  locationId: string,
  profileId: string
): Promise<void> {
  // Check if this is the owner - can't remove owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .single()

  if (profile?.role === "owner") {
    throw new ApiError("FORBIDDEN", "Cannot remove owner from location")
  }

  // Remove the profile-location link
  const { error } = await supabase
    .from("profile_locations")
    .delete()
    .eq("location_id", locationId)
    .eq("profile_id", profileId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
}

export async function updateMemberPermissions(
  locationId: string,
  profileId: string,
  permissions: {
    can_manage_binders?: boolean
    can_manage_forms?: boolean
    can_view_all_responses?: boolean
    can_export_reports?: boolean
    can_configure_integrations?: boolean
  }
): Promise<void> {
  // Verify the member is in this location
  const { data: link } = await supabase
    .from("profile_locations")
    .select("profile_id")
    .eq("location_id", locationId)
    .eq("profile_id", profileId)
    .single()

  if (!link) throw new ApiError("NOT_FOUND", "Member not found in this location")

  const { error } = await supabase
    .from("profiles")
    .update(permissions)
    .eq("id", profileId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
}
