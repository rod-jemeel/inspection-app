import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { auth, type Session } from "@/lib/auth"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"

export interface Profile {
  id: string
  user_id: string
  full_name: string
  username: string | null
  email: string | null
  phone: string | null
  role: "owner" | "admin" | "nurse" | "inspector"
  must_change_password: boolean
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
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    throw new ApiError("NOT_FOUND", "Profile not found")
  }

  return data as Profile
})

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
