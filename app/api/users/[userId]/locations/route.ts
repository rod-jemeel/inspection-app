import "server-only"
import { z } from "zod"
import { requireRole } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import {
  getProfileLocationMemberships,
  updateProfileLocationMemberships,
} from "@/lib/server/services/locations"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"

async function getProfileId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single()
  if (error || !data) throw new ApiError("NOT_FOUND", "User not found")
  return data.id
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    await requireRole(["owner", "admin"])
    const profileId = await getProfileId(userId)
    const memberships = await getProfileLocationMemberships(profileId)
    return Response.json(memberships)
  } catch (error) {
    return handleError(error)
  }
}

const updateSchema = z.object({
  location_ids: z.array(z.string().uuid()),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    await requireRole(["owner", "admin"])
    const profileId = await getProfileId(userId)

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    await updateProfileLocationMemberships(profileId, parsed.data.location_ids)
    const memberships = await getProfileLocationMemberships(profileId)
    return Response.json(memberships)
  } catch (error) {
    return handleError(error)
  }
}
