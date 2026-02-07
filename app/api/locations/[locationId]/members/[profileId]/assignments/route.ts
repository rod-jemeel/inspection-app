import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError } from "@/lib/server/errors"
import { getAssignmentsForProfile } from "@/lib/server/services/binders"

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
