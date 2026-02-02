import "server-only"
import { z } from "zod"
import { supabase } from "@/lib/server/db"
import { auth } from "@/lib/auth"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { generateSecurePassword } from "@/lib/server/utils/password"
import { sendWelcomeEmail } from "@/lib/server/services/email-sender"

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  fullName: z.string().min(1, "Full name is required"),
  role: z.enum(["admin", "nurse"], {
    message: "Role must be admin or nurse",
  }),
  locationIds: z.array(z.string().uuid()).min(1, "At least one location required"),
})

export async function POST(request: Request) {
  try {
    // 1. Verify caller is admin or owner
    const { profile } = await requireLocationAccess(null, ["owner", "admin"])

    // 2. Parse and validate input
    const body = await request.json()
    const input = createUserSchema.parse(body)

    // 3. Check if username already exists
    const { data: existingUser } = await supabase
      .from("user")
      .select("id")
      .eq("username", input.username)
      .single()

    if (existingUser) {
      return Response.json(
        { error: "A user with this username already exists" },
        { status: 409 }
      )
    }

    // 4. Verify caller has access to all requested locations
    const { data: callerLocations } = await supabase
      .from("profile_locations")
      .select("location_id")
      .eq("profile_id", profile.id)

    const callerLocationIds = new Set(
      (callerLocations ?? []).map((l) => l.location_id)
    )

    for (const locationId of input.locationIds) {
      if (!callerLocationIds.has(locationId)) {
        return Response.json(
          { error: "You do not have access to one or more selected locations" },
          { status: 403 }
        )
      }
    }

    // 5. Generate temp password
    const tempPassword = generateSecurePassword(16)

    // 6. Create user via Better Auth admin API (doesn't create session)
    const createResult = await auth.api.createUser({
      body: {
        email: input.email || `${input.username}@placeholder.local`,
        password: tempPassword,
        name: input.fullName,
        role: "user", // Better Auth role, not our app role
      },
    })

    if (!createResult || !createResult.user) {
      return Response.json(
        { error: "Failed to create user account" },
        { status: 500 }
      )
    }

    const userId = createResult.user.id

    // Update user to set correct email (null if not provided) and username
    await supabase
      .from("user")
      .update({
        email: input.email || null,
        username: input.username,
      })
      .eq("id", userId)

    // 7. Create profile with must_change_password flag
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        full_name: input.fullName,
        username: input.username,
        email: input.email || null,
        role: input.role,
        must_change_password: true,
      })
      .select()
      .single()

    if (profileError) {
      console.error("Profile creation error:", profileError)
      return Response.json(
        { error: "Failed to create user profile" },
        { status: 500 }
      )
    }

    // 8. Link to locations
    const locationLinks = input.locationIds.map((locationId) => ({
      profile_id: newProfile.id,
      location_id: locationId,
    }))

    const { error: linkError } = await supabase
      .from("profile_locations")
      .insert(locationLinks)

    if (linkError) {
      console.error("Profile-location link error:", linkError)
      return Response.json(
        { error: "Failed to assign user to locations" },
        { status: 500 }
      )
    }

    // 9. Send welcome email (only if email provided)
    if (input.email) {
      sendWelcomeEmail({
        to_email: input.email,
        full_name: input.fullName,
        temp_password: tempPassword,
      }).catch((err) => {
        console.error("Failed to send welcome email:", err)
      })
    }

    // 10. Return success with temp password (show on screen)
    return Response.json({
      success: true,
      user: {
        id: userId,
        profileId: newProfile.id,
        username: input.username,
        email: input.email || null,
        fullName: input.fullName,
        role: input.role,
      },
      tempPassword, // Show to admin on screen (important if no email)
      emailSent: !!input.email,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError
      return Response.json(
        { error: zodError.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }

    console.error("Create user error:", error)
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

// GET: List users in caller's locations
export async function GET() {
  try {
    const { profile } = await requireLocationAccess(null, [
      "owner",
      "admin",
      "nurse",
    ])

    // Get all locations the caller has access to
    const { data: callerLocations } = await supabase
      .from("profile_locations")
      .select("location_id")
      .eq("profile_id", profile.id)

    const locationIds = (callerLocations ?? []).map((l) => l.location_id)

    if (locationIds.length === 0) {
      return Response.json({ users: [] })
    }

    // Get all profiles linked to those locations
    const { data: profileLinks } = await supabase
      .from("profile_locations")
      .select("profile_id")
      .in("location_id", locationIds)

    const profileIds = [...new Set((profileLinks ?? []).map((l) => l.profile_id))]

    if (profileIds.length === 0) {
      return Response.json({ users: [] })
    }

    // Get profile details
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        user_id,
        full_name,
        email,
        role,
        created_at,
        profile_locations(location_id, locations(id, name))
      `
      )
      .in("id", profileIds)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("List users error:", error)
      return Response.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    return Response.json({ users: profiles ?? [] })
  } catch (error) {
    console.error("List users error:", error)
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
