import "server-only"
import { z } from "zod"
import { supabase } from "@/lib/server/db"
import { getSession, getProfile } from "@/lib/server/auth-helpers"

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const profile = await getProfile(session.user.id)

    const body = await request.json()
    const input = subscriptionSchema.parse(body)

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        profile_id: profile.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        user_agent: request.headers.get("user-agent"),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "profile_id,endpoint",
      }
    )

    if (error) {
      console.error("Push subscription error:", error)
      return Response.json({ error: "Failed to save subscription" }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid subscription data" }, { status: 400 })
    }

    console.error("Subscribe error:", error)
    return Response.json({ error: "Failed to subscribe" }, { status: 500 })
  }
}
