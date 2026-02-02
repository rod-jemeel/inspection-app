import "server-only"
import { z } from "zod"
import { supabase } from "@/lib/server/db"
import { requireSession } from "@/lib/server/auth-helpers"
import { TIMEZONES } from "@/lib/validations/location"

const createLocationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  address: z.string().max(500).optional().nullable(),
  timezone: z.enum(TIMEZONES),
})

export async function POST(request: Request) {
  try {
    // 1. Require authenticated session
    const { profile } = await requireSession()

    // 2. Only admins and owners can create locations
    if (profile.role !== "admin" && profile.role !== "owner") {
      return Response.json(
        { error: { message: "Only admins can create locations" } },
        { status: 403 }
      )
    }

    // 3. Parse and validate input
    const body = await request.json()
    const input = createLocationSchema.parse(body)

    // 4. Create location
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .insert({
        name: input.name,
        address: input.address || null,
        timezone: input.timezone,
        active: true,
      })
      .select()
      .single()

    if (locationError) {
      console.error("Location creation error:", locationError)
      return Response.json(
        { error: { message: "Failed to create location" } },
        { status: 500 }
      )
    }

    // 5. Link current user's profile to the new location
    const { error: linkError } = await supabase
      .from("profile_locations")
      .insert({
        profile_id: profile.id,
        location_id: location.id,
      })

    if (linkError) {
      console.error("Profile-location link error:", linkError)
      // Location was created, so we don't fail completely
    }

    return Response.json({
      data: location,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: { message: error.issues[0]?.message ?? "Validation failed" } },
        { status: 400 }
      )
    }

    console.error("Create location error:", error)
    return Response.json(
      { error: { message: "An unexpected error occurred" } },
      { status: 500 }
    )
  }
}
