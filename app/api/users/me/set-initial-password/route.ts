import "server-only"
import { z } from "zod"
import { hashPassword } from "better-auth/crypto"
import { supabase } from "@/lib/server/db"
import { getSession, getProfile } from "@/lib/server/auth-helpers"

const schema = z.object({
  newPassword: z.string().min(12, "Password must be at least 12 characters"),
})

/**
 * POST /api/users/me/set-initial-password
 * Sets a new password for the current user WITHOUT requiring the current password.
 * Only allowed when must_change_password = true (forced password change after admin creation).
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    const profile = await getProfile(session.user.id)

    // Only allow this bypass when the user is in a forced password change state
    if (!profile.must_change_password) {
      return Response.json(
        { error: "Password change not required — use the standard change password flow" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { newPassword } = schema.parse(body)

    // Hash the password using the same algorithm Better Auth uses (scrypt)
    const hashed = await hashPassword(newPassword)

    // Update the password directly in the account table
    const { error: updateError } = await supabase
      .from("account")
      .update({ password: hashed })
      .eq("userId", session.user.id)
      .eq("providerId", "credential")

    if (updateError) {
      console.error("Failed to update password:", updateError)
      return Response.json({ error: "Failed to update password" }, { status: 500 })
    }

    // Clear the must_change_password flag
    const { error: flagError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id)

    if (flagError) {
      console.error("Failed to clear password flag:", flagError)
      // Password was changed successfully, just log the flag error
    }

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Set initial password error:", error)
    return Response.json({ error: "Failed to update password" }, { status: 500 })
  }
}
