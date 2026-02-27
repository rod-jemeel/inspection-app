export interface HumanizedAuditChange {
  path: string
  group: string
  label: string
  text: string
}

export interface HumanizedAuditGroup {
  title: string
  changes: HumanizedAuditChange[]
}

export interface HumanizedAuditEvent {
  id: string
  eventType: "created" | "updated" | "submitted_complete" | "reverted_draft" | "deleted"
  eventLabel: string
  actorName: string
  actorRole: string | null
  at: string
  summaryText: string
  changes: HumanizedAuditChange[]
  groups: HumanizedAuditGroup[]
}

export interface FetchLogEntryEventsParams {
  locationId: string
  logType: string
  logKey: string
  logDate: string
  limit?: number
  offset?: number
}

export async function fetchLogEntryEvents(params: FetchLogEntryEventsParams) {
  const qs = new URLSearchParams({
    log_type: params.logType,
    log_key: params.logKey,
    log_date: params.logDate,
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
  })

  const res = await fetch(`/api/locations/${params.locationId}/logs/events?${qs.toString()}`, {
    cache: "no-store",
  })

  if (!res.ok) {
    let message = "Failed to load recent changes"
    try {
      const err = await res.json()
      message = err?.error?.message ?? message
    } catch {
      // ignore malformed error payloads
    }
    throw new Error(message)
  }

  return res.json() as Promise<{ events: HumanizedAuditEvent[]; total?: number }>
}
