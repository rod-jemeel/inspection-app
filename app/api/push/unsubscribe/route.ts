import "server-only"
import { z } from "zod"
import { supabase } from "@/lib/server/db"
import { getSession, getProfile } from "@/lib/server/auth-helpers"

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const profile = await getProfile(session.user.id)

    const body = await request.json()
    const input = unsubscribeSchema.parse(body)

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("profile_id", profile.id)
      .eq("endpoint", input.endpoint)

    if (error) {
      console.error("Push unsubscribe error:", error)
      return Response.json({ error: "Failed to unsubscribe" }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request data" }, { status: 400 })
    }

    console.error("Unsubscribe error:", error)
    return Response.json({ error: "Failed to unsubscribe" }, { status: 500 })
  }
}
