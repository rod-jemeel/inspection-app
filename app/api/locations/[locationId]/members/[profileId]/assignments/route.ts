import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { getAssignmentsForProfile, updateProfileAssignments } from "@/lib/server/services/binders"
import { updateProfileAssignmentsSchema } from "@/lib/validations/binder"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; profileId: string }> }
) {
  try {
    const { locationId, profileId } = await params
    await requireLocationAccess(locationId, ["admin", "owner"])
    const assignments = await getAssignmentsForProfile(locationId, profileId)
    return Response.json(assignments)
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; profileId: string }> }
) {
  try {
    const { locationId, profileId } = await params
    const { profile } = await requireLocationAccess(locationId, ["admin", "owner"])

    const body = await request.json()
    const parsed = updateProfileAssignmentsSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const assignments = await updateProfileAssignments(locationId, profileId, parsed.data, profile.id)
    return Response.json(assignments)
  } catch (error) {
    return handleError(error)
  }
}
