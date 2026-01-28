import "server-only"
import { supabase } from "@/lib/server/db"
import { requireRole } from "@/lib/server/auth-helpers"
import { generateSecurePassword } from "@/lib/server/utils/password"
import { sendWelcomeEmail } from "@/lib/server/services/email-sender"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // 1. Verify caller is admin or owner
    await requireRole(["owner", "admin"])

    // 2. Get the target user's profile
    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_id")
      .eq("user_id", userId)
      .single()

    if (profileError || !targetProfile) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    // 3. Generate new temp password
    const tempPassword = generateSecurePassword(16)

    // 4. Update password in Better Auth user table
    // Better Auth stores password hash in the account table
    const { createHash } = await import("crypto")
    const bcrypt = await import("bcryptjs")
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    const { error: updateError } = await supabase
      .from("account")
      .update({ password: hashedPassword })
      .eq("userId", userId)
      .eq("providerId", "credential")

    if (updateError) {
      console.error("Password update error:", updateError)
      return Response.json(
        { error: "Failed to reset password" },
        { status: 500 }
      )
    }

    // 5. Set must_change_password flag
    await supabase
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", targetProfile.id)

    // 6. Send email with new temp password (non-blocking)
    sendWelcomeEmail({
      to_email: targetProfile.email,
      full_name: targetProfile.full_name,
      temp_password: tempPassword,
    }).catch((err) => {
      console.error("Failed to send password reset email:", err)
    })

    // 7. Return password (show to admin)
    return Response.json({
      success: true,
      tempPassword,
      message: "Password reset successfully. User will be required to change it on next login.",
    })
  } catch (error) {
    console.error("Admin password reset error:", error)
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
