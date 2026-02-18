import "server-only"
import { z } from "zod"
import { supabase } from "@/lib/server/db"
import { requireSession } from "@/lib/server/auth-helpers"

const updateProfileSignatureSchema = z.object({
  signature_image: z.string().nullable(),
  default_initials: z.string().max(5).nullable(),
})

export async function GET() {
  try {
    const { profile } = await requireSession()

    return Response.json({
      name: profile.full_name,
      signature_image: profile.signature_image,
      default_initials: profile.default_initials,
    })
  } catch (error) {
    console.error("Get signature error:", error)
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { profile } = await requireSession()

    const body = await request.json()
    const parsed = updateProfileSignatureSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request data", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { signature_image, default_initials } = parsed.data

    const { error } = await supabase
      .from("profiles")
      .update({
        signature_image,
        default_initials,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)

    if (error) {
      console.error("Failed to update signature:", error)
      return Response.json(
        { error: "Failed to update profile" },
        { status: 500 }
      )
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error("Update signature error:", error)
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
