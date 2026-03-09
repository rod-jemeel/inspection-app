import { NextRequest } from "next/server"
import { exchangeInviteSchema } from "@/lib/validations/invite"
import { consumeInviteCode, exchangeInviteCode } from "@/lib/server/services/invite-codes"
import { handleError, validationError, ApiError } from "@/lib/server/errors"
import { supabase } from "@/lib/server/db"
import { auth } from "@/lib/auth"
import {
  ensureProfileForUser,
  ensureProfileLocation,
  rollbackCreatedUser,
  updateAuthUserIdentity,
} from "@/lib/server/services/user-provisioning"

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
    let createdUserId: string | null = null

    if (existingUser) {
      userId = existingUser.id
      password = tempPassword
    } else {
      // Create user via Better Auth admin API (server-side user creation)
      let result
      try {
        result = await auth.api.createUser({
          body: {
            email: inspectorEmail,
            password: tempPassword,
            name: inspectorName,
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
      createdUserId = userId
    }

    try {
      if (!existingUser) {
        await updateAuthUserIdentity(userId, {
          emailVerified: true,
        })
      }

      const profile = await ensureProfileForUser({
        userId,
        fullName: inspectorName,
        email: inspectorEmail,
        role: invite.role_grant,
      })

      if (existingUser && profile.role !== invite.role_grant) {
        throw new ApiError("FORBIDDEN", `This invite grants ${invite.role_grant} access, but the existing account is ${profile.role}. Use an account with the correct role or create a separate inspector login.`)
      }

      await ensureProfileLocation(profile.id, invite.location_id)
      await consumeInviteCode(invite)
    } catch (error) {
      if (createdUserId) {
        await rollbackCreatedUser(createdUserId)
      }
      throw error
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
