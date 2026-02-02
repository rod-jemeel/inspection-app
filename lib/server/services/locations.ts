import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { UpdateLocationInput } from "@/lib/validations/location"

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
  role: "owner" | "admin" | "nurse" | "inspector"
  created_at: string
}

export async function getLocation(locationId: string): Promise<Location> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
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
        created_at
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
