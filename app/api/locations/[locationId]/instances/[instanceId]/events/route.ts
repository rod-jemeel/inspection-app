import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError } from "@/lib/server/errors"
import { getInstance } from "@/lib/server/services/instances"
import { listEvents } from "@/lib/server/services/events"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; instanceId: string }> }
) {
  try {
    const { locationId, instanceId } = await params
    await requireLocationAccess(locationId)

    // Verify instance belongs to this location
    await getInstance(locationId, instanceId)

    const events = await listEvents(instanceId)
    return Response.json({ data: events })
  } catch (error) {
    return handleError(error)
  }
}
