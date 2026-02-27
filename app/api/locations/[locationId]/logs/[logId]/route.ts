import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError } from "@/lib/server/errors"
import { getLogEntry, deleteLogEntry } from "@/lib/server/services/log-entries"
import { appendLogEntryEvent } from "@/lib/server/services/log-entry-events"
import { buildDeleteAuditPayload } from "@/lib/server/services/log-entry-diff"
import type { LogEntryAuditLogType } from "@/lib/validations/log-entry-events"

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
    const { profile } = await requireLocationAccess(locationId, ["admin", "owner"])

    const existing = await getLogEntry(locationId, logId)

    await deleteLogEntry(locationId, logId)

    await appendLogEntryEvent({
      log_entry_id: null,
      location_id: locationId,
      log_type: existing.log_type as LogEntryAuditLogType,
      log_key: existing.log_key ?? "",
      log_date: existing.log_date,
      event_type: "deleted",
      actor_profile_id: profile.id,
      payload: {
        ...buildDeleteAuditPayload({
          logType: existing.log_type as LogEntryAuditLogType,
          status: existing.status,
          data: existing.data,
        }),
        meta: { source: "logs-api", deleted_log_entry_id: existing.id },
      },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleError(error)
  }
}
