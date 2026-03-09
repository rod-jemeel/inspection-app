import "server-only"
import { z } from "zod"
import { supabase } from "@/lib/server/db"
import { auth } from "@/lib/auth"
import { checkHasUsers } from "@/lib/server/utils/password"
import {
  ensureProfileForUser,
  rollbackCreatedUser,
  updateAuthUserIdentity,
} from "@/lib/server/services/user-provisioning"

const setupSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  password: z.string().min(12, "Password must be at least 12 characters"),
  locationName: z.string().min(1, "Location name is required"),
  locationAddress: z.string().max(500).optional(),
  timezone: z.string().min(1, "Timezone is required"),
})

export async function POST(request: Request) {
  try {
    // 1. Verify no users exist (critical security check)
    const hasUsers = await checkHasUsers()
    if (hasUsers) {
      return Response.json(
        { error: "Setup has already been completed" },
        { status: 403 }
      )
    }

    // 2. Parse and validate input
    const body = await request.json()
    const input = setupSchema.parse(body)

    // 3. Create user via Better Auth with username
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: input.email || `${input.username}@placeholder.local`, // Better Auth requires email
        password: input.password,
        name: input.fullName,
        username: input.username,
      },
    })

    if (!signUpResult || !signUpResult.user) {
      return Response.json(
        { error: "Failed to create user account" },
        { status: 500 }
      )
    }

    const userId = signUpResult.user.id

    try {
      await updateAuthUserIdentity(userId, {
        email: input.email || null,
        username: input.username,
      })

      const profile = await ensureProfileForUser({
        userId,
        fullName: input.fullName,
        username: input.username,
        email: input.email || null,
        role: "owner",
        mustChangePassword: false,
      })

      const { data: location, error: locationError } = await supabase
        .from("locations")
        .insert({
          name: input.locationName,
          address: input.locationAddress || null,
          timezone: input.timezone,
          active: true,
        })
        .select()
        .single()

      if (locationError || !location) {
        throw new Error(locationError?.message || "Failed to create location")
      }

      const { error: linkError } = await supabase
        .from("profile_locations")
        .insert({
          profile_id: profile.id,
          location_id: location.id,
        })

      if (linkError) {
        throw new Error(linkError.message)
      }
    } catch (error) {
      console.error("Setup provisioning error:", error)
      await rollbackCreatedUser(userId)
      return Response.json(
        { error: "Failed to complete setup" },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      message: "Setup completed successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError
      return Response.json(
        { error: zodError.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      )
    }

    console.error("Setup error:", error)
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
