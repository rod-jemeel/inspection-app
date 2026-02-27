import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { listLogEntryEventsByIdentity } from "@/lib/server/services/log-entry-events"
import { humanizeLogEntryAuditEvent } from "@/lib/server/services/log-entry-audit-humanize"
import { listLogEntryEventsQuerySchema } from "@/lib/validations/log-entry-events"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    const { profile } = await requireLocationAccess(locationId)

    const url = new URL(request.url)
    const raw = Object.fromEntries(url.searchParams)
    const parsed = listLogEntryEventsQuerySchema.safeParse(raw)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const result = await listLogEntryEventsByIdentity({
      locationId,
      logType: parsed.data.log_type,
      logKey: parsed.data.log_key,
      logDate: parsed.data.log_date,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    })

    return Response.json({
      events: result.events.map((event) => humanizeLogEntryAuditEvent(event, profile.role)),
      total: result.total,
    })
  } catch (error) {
    return handleError(error)
  }
}
