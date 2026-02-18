import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { auth, type Session } from "@/lib/auth"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { Role } from "@/lib/permissions"

export interface Profile {
  id: string
  user_id: string
  full_name: string
  username: string | null
  email: string | null
  phone: string | null
  role: Role
  must_change_password: boolean
  can_manage_binders: boolean
  can_manage_forms: boolean
  can_view_all_responses: boolean
  can_export_reports: boolean
  can_configure_integrations: boolean
  signature_image: string | null
  default_initials: string | null
  created_at: string
  updated_at: string
}

export const getSession = cache(async (): Promise<Session> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session) {
    throw new ApiError("UNAUTHORIZED", "Authentication required")
  }
  return session
})

export const getProfile = cache(async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, username, email, phone, role, must_change_password, can_manage_binders, can_manage_forms, can_view_all_responses, can_export_reports, can_configure_integrations, signature_image, default_initials, created_at, updated_at")
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    throw new ApiError("NOT_FOUND", "Profile not found")
  }

  return data as Profile
})

/**
 * Require authenticated session with profile (no location check)
 * Use for endpoints that don't require specific location access
 */
export async function requireSession(): Promise<{ session: Session; profile: Profile }> {
  const session = await getSession()
  const profile = await getProfile(session.user.id)
  return { session, profile }
}

export async function requireLocationAccess(
  locationId: string | null,
  allowedRoles?: string[]
): Promise<{ session: Session; profile: Profile }> {
  const session = await getSession()
  const profile = await getProfile(session.user.id)

  // If locationId provided, verify access to that specific location
  if (locationId) {
    const { data: membership } = await supabase
      .from("profile_locations")
      .select("location_id")
      .eq("profile_id", profile.id)
      .eq("location_id", locationId)
      .single()

    if (!membership) {
      throw new ApiError("FORBIDDEN", "No access to this location")
    }
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new ApiError("ROLE_REQUIRED", `Role required: ${allowedRoles.join(" or ")}`)
  }

  return { session, profile }
}

/**
 * Simple role check without location verification
 * Use for endpoints that operate across all user's locations
 */
export async function requireRole(
  allowedRoles: string[]
): Promise<{ session: Session; profile: Profile }> {
  const session = await getSession()
  const profile = await getProfile(session.user.id)

  if (!allowedRoles.includes(profile.role)) {
    throw new ApiError("ROLE_REQUIRED", `Role required: ${allowedRoles.join(" or ")}`)
  }

  return { session, profile }
}

type PermissionFlag = "can_manage_binders" | "can_manage_forms" | "can_view_all_responses" | "can_export_reports" | "can_configure_integrations"

/**
 * Require a specific permission flag on the user's profile.
 * Owner role always passes (god mode).
 */
export async function requirePermission(
  permission: PermissionFlag,
  locationId?: string
): Promise<{ session: Session; profile: Profile }> {
  const session = await getSession()
  const profile = await getProfile(session.user.id)

  // Verify location access if provided
  if (locationId) {
    const { data: membership } = await supabase
      .from("profile_locations")
      .select("location_id")
      .eq("profile_id", profile.id)
      .eq("location_id", locationId)
      .single()

    if (!membership) {
      throw new ApiError("FORBIDDEN", "No access to this location")
    }
  }

  // Owner always has all permissions
  if (profile.role === "owner") return { session, profile }

  if (!profile[permission]) {
    throw new ApiError("FORBIDDEN", `Missing permission: ${permission}`)
  }

  return { session, profile }
}

/** Require can_manage_binders permission */
export async function requireBinderManagement(locationId?: string) {
  return requirePermission("can_manage_binders", locationId)
}

/** Require can_manage_forms permission */
export async function requireFormManagement(locationId?: string) {
  return requirePermission("can_manage_forms", locationId)
}

/** Require can_view_all_responses permission */
export async function requireViewAllResponses(locationId?: string) {
  return requirePermission("can_view_all_responses", locationId)
}

/** Require can_export_reports permission */
export async function requireExportReports(locationId?: string) {
  return requirePermission("can_export_reports", locationId)
}

/** Require can_configure_integrations permission */
export async function requireIntegrationConfig(locationId?: string) {
  return requirePermission("can_configure_integrations", locationId)
}

/**
 * Require edit permission for a binder's forms/fields.
 * Passes if: owner, profile-level can_manage_forms, OR binder-level can_edit assignment.
 */
export async function requireFormEdit(
  locationId: string,
  binderId: string
): Promise<{ session: Session; profile: Profile }> {
  const session = await getSession()
  const profile = await getProfile(session.user.id)

  // Owner always has edit rights
  if (profile.role === "owner") return { session, profile }

  // Profile-level form management permission
  if (profile.can_manage_forms) return { session, profile }

  // Check binder-level can_edit assignment
  const { data } = await supabase
    .from("binder_assignments")
    .select("can_edit")
    .eq("binder_id", binderId)
    .eq("profile_id", profile.id)
    .single()

  if (data?.can_edit) return { session, profile }

  throw new ApiError("FORBIDDEN", "Edit permission required for this binder")
}
