import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError } from "@/lib/server/errors"
import { getTeamMembers } from "@/lib/server/services/locations"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId)
    const members = await getTeamMembers(locationId)
    return Response.json(members)
  } catch (error) {
    return handleError(error)
  }
}
