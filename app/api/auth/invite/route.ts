import { NextRequest } from "next/server"
import { exchangeInviteSchema } from "@/lib/validations/invite"
import { exchangeInviteCode } from "@/lib/server/services/invite-codes"
import { handleError, validationError, ApiError } from "@/lib/server/errors"
import { supabase } from "@/lib/server/db"
import { auth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = exchangeInviteSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    const invite = await exchangeInviteCode(parsed.data.code)

    // Create or find inspector user
    const inspectorEmail = parsed.data.email ?? invite.assigned_email ?? `inspector-${invite.id}@invite.local`
    const inspectorName = parsed.data.name ?? "Inspector"

    // Generate a temporary password for the user
    const tempPassword = crypto.randomUUID()

    // Check if user already exists in Better Auth
    const { data: existingUser } = await supabase
      .from("user")
      .select("id, email")
      .eq("email", inspectorEmail)
      .single()

    let userId: string
    let password: string

    if (existingUser) {
      userId = existingUser.id
      password = tempPassword

      // For existing users, we can't easily update their password through Better Auth
      // In production, you'd want to implement a password reset flow
      // For MVP, we'll just return success and let them sign in with their existing credentials
    } else {
      // Create user via Better Auth admin API (server-side user creation)
      let result
      try {
        result = await auth.api.createUser({
          body: {
            email: inspectorEmail,
            password: tempPassword,
            name: inspectorName,
            role: "user", // Better Auth role, not our app role
          },
        })
      } catch (createUserError) {
        console.error("Better Auth createUser error:", createUserError)
        throw new ApiError("INTERNAL_ERROR", `Failed to create account: ${createUserError instanceof Error ? createUserError.message : "Unknown error"}`)
      }

      if (!result?.user?.id) {
        console.error("Better Auth createUser returned no user:", result)
        throw new ApiError("INTERNAL_ERROR", "Failed to create inspector account - no user returned")
      }

      userId = result.user.id
      password = tempPassword

      // Mark email as verified
      await supabase
        .from("user")
        .update({ emailVerified: true })
        .eq("id", userId)

      // Create profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: userId,
          full_name: inspectorName,
          email: inspectorEmail,
          role: invite.role_grant,
        })
        .select("id")
        .single()

      if (profileError || !profile) {
        console.error("Profile creation error:", profileError)
        throw new ApiError("INTERNAL_ERROR", `Failed to create profile: ${profileError?.message || "Unknown error"}`)
      }

      // Link to location
      const { error: locationError } = await supabase
        .from("profile_locations")
        .insert({
          profile_id: profile.id,
          location_id: invite.location_id,
        })

      if (locationError) {
        console.error("Location link error:", locationError)
        throw new ApiError("INTERNAL_ERROR", `Failed to link to location: ${locationError.message}`)
      }
    }

    // Return credentials so client can sign in
    return Response.json({
      success: true,
      locationId: invite.location_id,
      role: invite.role_grant,
      credentials: existingUser ? null : { email: inspectorEmail, password },
    })
  } catch (error) {
    return handleError(error)
  }
}
