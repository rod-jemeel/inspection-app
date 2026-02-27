"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { fetchLogEntryEvents, type HumanizedAuditEvent } from "@/lib/client/log-entry-events"
import { AuditEventRow } from "./audit-event-row"

interface RecentLogChangesPanelProps {
  locationId: string
  logType: string
  logKey: string
  logDate: string
  enabled?: boolean
  refreshKey?: number | string
  defaultOpen?: boolean
  limit?: number
}

export function RecentLogChangesPanel({
  locationId,
  logType,
  logKey,
  logDate,
  enabled = true,
  refreshKey,
  defaultOpen = true,
  limit = 10,
}: RecentLogChangesPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<HumanizedAuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    setOffset(0)
  }, [locationId, logType, logKey, logDate, refreshKey, limit])

  useEffect(() => {
    if (!enabled || !locationId || !logType || !logDate) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchLogEntryEvents({
          locationId,
          logType,
          logKey,
          logDate,
          limit,
          offset,
        })
        if (!cancelled) {
          setEvents(result.events ?? [])
          setTotal(result.total ?? 0)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load recent changes")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [enabled, locationId, logType, logKey, logDate, refreshKey, limit, offset])

  if (!enabled) return null

  const hasPrev = offset > 0
  const hasNext = offset + events.length < total
  const start = total === 0 ? 0 : offset + 1
  const end = total === 0 ? 0 : offset + events.length

  return (
    <section className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Recent Changes</h4>
          <p className="text-xs text-muted-foreground">
            Shows who changed this log and what changed, in plain language.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Collapse" : "Expand"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-2">
          {loading && <p className="text-xs text-muted-foreground">Loading recent changes...</p>}
          {!loading && error && <p className="text-xs text-destructive">{error}</p>}
          {!loading && !error && events.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No recent changes yet for this log.
            </p>
          )}
          {!loading && !error && events.map((event) => <AuditEventRow key={event.id} event={event} />)}

          {!loading && !error && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {start}-{end} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => setOffset((v) => Math.max(0, v - limit))}
                  disabled={!hasPrev}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => setOffset((v) => v + limit)}
                  disabled={!hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
