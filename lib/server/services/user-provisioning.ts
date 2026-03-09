import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { Role } from "@/lib/permissions"

interface EnsureProfileForUserParams {
  userId: string
  fullName: string
  email: string | null
  role: Role
  username?: string | null
  mustChangePassword?: boolean
}

interface ProvisionedProfile {
  id: string
  user_id: string
  full_name: string
  email: string | null
  username: string | null
  role: Role
}

export async function updateAuthUserIdentity(
  userId: string,
  attrs: {
    email?: string | null
    emailVerified?: boolean
    username?: string | null
  }
) {
  const { error } = await supabase
    .from("user")
    .update(attrs)
    .eq("id", userId)

  if (error) {
    throw new ApiError("INTERNAL_ERROR", `Failed to update auth user: ${error.message}`)
  }
}

export async function ensureProfileForUser(
  params: EnsureProfileForUserParams
): Promise<ProvisionedProfile> {
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email, username, role")
    .eq("user_id", params.userId)
    .maybeSingle()

  if (existingError) {
    throw new ApiError("INTERNAL_ERROR", `Failed to load profile: ${existingError.message}`)
  }

  if (existing) {
    const updates: Record<string, string | boolean | null> = {}
    if (!existing.full_name?.trim() && params.fullName.trim()) {
      updates.full_name = params.fullName.trim()
    }
    if (!existing.email && params.email) {
      updates.email = params.email
    }
    if (!existing.username && params.username) {
      updates.username = params.username
    }
    if (typeof params.mustChangePassword === "boolean") {
      updates.must_change_password = params.mustChangePassword
    }

    if (Object.keys(updates).length === 0) {
      return existing as ProvisionedProfile
    }

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, user_id, full_name, email, username, role")
      .single()

    if (updateError || !updated) {
      throw new ApiError("INTERNAL_ERROR", `Failed to update profile: ${updateError?.message ?? "Unknown error"}`)
    }

    return updated as ProvisionedProfile
  }

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      user_id: params.userId,
      full_name: params.fullName.trim(),
      email: params.email,
      username: params.username ?? null,
      role: params.role,
      must_change_password: params.mustChangePassword ?? false,
    })
    .select("id, user_id, full_name, email, username, role")
    .single()

  if (createError || !created) {
    throw new ApiError("INTERNAL_ERROR", `Failed to create profile: ${createError?.message ?? "Unknown error"}`)
  }

  return created as ProvisionedProfile
}

export async function ensureProfileLocation(profileId: string, locationId: string) {
  const { error } = await supabase
    .from("profile_locations")
    .upsert(
      {
        profile_id: profileId,
        location_id: locationId,
      },
      {
        onConflict: "profile_id,location_id",
      }
    )

  if (error) {
    throw new ApiError("INTERNAL_ERROR", `Failed to link profile to location: ${error.message}`)
  }
}

export async function deleteAuthUserById(userId: string) {
  const { error } = await supabase
    .from("user")
    .delete()
    .eq("id", userId)

  if (error) {
    throw new ApiError("INTERNAL_ERROR", `Failed to delete auth user: ${error.message}`)
  }
}

export async function rollbackCreatedUser(userId: string) {
  try {
    await deleteAuthUserById(userId)
  } catch (error) {
    console.error("Failed to rollback auth user:", { userId, error })
  }
}
