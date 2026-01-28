import "server-only"
import { supabase } from "@/lib/server/db"
import { getSession, getProfile } from "@/lib/server/auth-helpers"

export async function POST() {
  try {
    const session = await getSession()
    const profile = await getProfile(session.user.id)

    // Clear the must_change_password flag
    const { error } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id)

    if (error) {
      console.error("Failed to clear password flag:", error)
      return Response.json(
        { error: "Failed to update profile" },
        { status: 500 }
      )
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error("Clear password flag error:", error)
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
