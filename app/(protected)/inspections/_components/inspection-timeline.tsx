"use client"

import {
  Play,
  XCircle,
  CheckCircle,
  PenTool,
  Plus,
  AlertTriangle,
  Bell,
  MessageSquare,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface InspectionEvent {
  id: string
  event_type: string
  event_at: string
  payload: Record<string, unknown> | null
}

interface InspectionTimelineProps {
  events: InspectionEvent[]
}

const EVENT_ICONS = {
  created: { Icon: Plus, color: "text-primary" },
  assigned: { Icon: UserPlus, color: "text-primary" },
  started: { Icon: Play, color: "text-primary" },
  failed: { Icon: XCircle, color: "text-destructive" },
  passed: { Icon: CheckCircle, color: "text-primary" },
  signed: { Icon: PenTool, color: "text-primary" },
  comment: { Icon: MessageSquare, color: "text-muted-foreground" },
  reminder_sent: { Icon: Bell, color: "text-muted-foreground" },
  escalated: { Icon: AlertTriangle, color: "text-destructive" },
}

// Date formatter
const shortDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

export function InspectionTimeline({ events }: InspectionTimelineProps) {
  const formatEventTime = (dateString: string) => {
    return shortDateTimeFormatter.format(new Date(dateString))
  }

  if (events.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">Activity Timeline</div>
      <div className="space-y-3">
        {events.slice(0, 5).map((event) => {
          const config =
            EVENT_ICONS[event.event_type as keyof typeof EVENT_ICONS] ??
            EVENT_ICONS.comment
          const Icon = config.Icon

          return (
            <div key={event.id} className="flex gap-2">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border bg-background",
                  config.color
                )}
              >
                <Icon className="size-3" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs font-medium capitalize">
                    {event.event_type.replace("_", " ")}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatEventTime(event.event_at)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {events.length > 5 && (
          <p className="text-[10px] text-muted-foreground">
            +{events.length - 5} more events
          </p>
        )}
      </div>
    </div>
  )
}
