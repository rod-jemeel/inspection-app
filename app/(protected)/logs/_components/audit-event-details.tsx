"use client"

import type { HumanizedAuditGroup } from "@/lib/client/log-entry-events"

interface AuditEventDetailsProps {
  groups: HumanizedAuditGroup[]
}

export function AuditEventDetails({ groups }: AuditEventDetailsProps) {
  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No field-level changes were recorded for this event.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.title} className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.title}
          </p>
          <ul className="space-y-1">
            {group.changes.map((change) => (
              <li key={`${change.path}-${change.text}`} className="text-xs leading-5 text-foreground/90">
                {change.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
