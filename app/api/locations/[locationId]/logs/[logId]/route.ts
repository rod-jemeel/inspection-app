import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError } from "@/lib/server/errors"
import { getLogEntry, deleteLogEntry } from "@/lib/server/services/log-entries"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; logId: string }> }
) {
  try {
    const { locationId, logId } = await params
    await requireLocationAccess(locationId)

    const entry = await getLogEntry(locationId, logId)
    return Response.json(entry)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; logId: string }> }
) {
  try {
    const { locationId, logId } = await params
    await requireLocationAccess(locationId, ["admin", "owner"])

    await deleteLogEntry(locationId, logId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleError(error)
  }
}
