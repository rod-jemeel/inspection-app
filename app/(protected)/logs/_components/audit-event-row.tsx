"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AuditEventDetails } from "./audit-event-details"
import type { HumanizedAuditEvent } from "@/lib/client/log-entry-events"

interface AuditEventRowProps {
  event: HumanizedAuditEvent
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function AuditEventRow({ event }: AuditEventRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-md border border-border/60 bg-background">
      <div className="flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium leading-5">{event.summaryText}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{event.eventLabel}</span>
            <span aria-hidden="true">•</span>
            <time dateTime={event.at} title={new Date(event.at).toISOString()}>
              {formatWhen(event.at)}
            </time>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide details" : "View details"}
        </Button>
      </div>

      {open && (
        <div className="border-t border-border/60 px-3 py-3">
          <AuditEventDetails groups={event.groups} />
        </div>
      )}
    </div>
  )
}
