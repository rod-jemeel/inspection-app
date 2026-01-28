"use client"

import {
  Plus, UserPlus, Play, XCircle, CheckCircle,
  PenNib, ChatText, Bell, Warning, Clock
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  id: string
  event_type: string
  event_at: string
  actor_profile_id: string | null
  payload: Record<string, unknown> | null
}

const EVENT_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  created: { icon: Plus, label: "Created", color: "text-primary" },
  assigned: { icon: UserPlus, label: "Assigned", color: "text-foreground" },
  started: { icon: Play, label: "Started", color: "text-primary" },
  failed: { icon: XCircle, label: "Failed", color: "text-destructive" },
  passed: { icon: CheckCircle, label: "Passed", color: "text-primary" },
  signed: { icon: PenNib, label: "Signed", color: "text-primary" },
  comment: { icon: ChatText, label: "Comment", color: "text-foreground" },
  reminder_sent: { icon: Bell, label: "Reminder Sent", color: "text-muted-foreground" },
  escalated: { icon: Warning, label: "Escalated", color: "text-destructive" },
}

export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        No events yet
      </div>
    )
  }

  return (
    <div data-slot="event-timeline" className="space-y-0">
      {events.map((event, index) => {
        const config = EVENT_CONFIG[event.event_type] ?? {
          icon: Clock,
          label: event.event_type,
          color: "text-muted-foreground",
        }
        const Icon = config.icon
        const isLast = index === events.length - 1

        return (
          <div key={event.id} className="relative flex gap-3 pb-4">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-border" />
            )}

            {/* Icon */}
            <div
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-none bg-background",
                config.color
              )}
            >
              <Icon weight="bold" className="size-3.5" />
            </div>

            {/* Content */}
            <div className="flex-1 space-y-0.5 pt-0.5">
              <div className="text-xs font-medium">{config.label}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(event.event_at).toLocaleString()}
              </div>
              {event.payload?.remarks != null && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {String(event.payload.remarks)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
