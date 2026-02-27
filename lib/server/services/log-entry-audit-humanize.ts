import type { Role } from "@/lib/permissions"
import type { LogEntryAuditLogType } from "@/lib/validations/log-entry-events"
import type { LogEntryAuditChange } from "./log-entry-diff"
import type { LogEntryAuditEvent, LogEntryAuditEventType } from "./log-entry-events"

export interface HumanizedAuditChange {
  path: string
  group: string
  label: string
  text: string
}

export interface HumanizedAuditEvent {
  id: string
  eventType: LogEntryAuditEventType
  eventLabel: string
  actorName: string
  actorRole: Role | null
  at: string
  summaryText: string
  changes: HumanizedAuditChange[]
  groups: Array<{ title: string; changes: HumanizedAuditChange[] }>
}

type Seg = string | number

function parsePath(path: string): Seg[] {
  const segments: Seg[] = []
  const re = /([^[.\]]+)|\[(\d+)\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(path))) {
    if (match[1]) segments.push(match[1])
    else if (match[2]) segments.push(Number(match[2]))
  }
  return segments
}

function humanizeToken(token: string): string {
  const cleaned = token.replace(/_/g, " ").trim()
  if (!cleaned) return "Field"
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function labelForPath(logType: LogEntryAuditLogType, path: string): string {
  if (path === "status") return "Record status"

  const segments = parsePath(path)
  const last = segments.at(-1)
  if (typeof last === "number") return "Row"
  if (!last) return "Field"

  if (last === "sig" || last === "signature") return "Signature"
  if (last === "patient_name") return "Patient name"
  if (last === "new_lock") return "Lock code"

  if (logType === "crash_cart_daily" && segments[0] === "checks" && typeof segments[2] === "string") {
    return humanizeToken(segments[2])
  }

  return humanizeToken(String(last))
}

function groupForPath(path: string): string {
  const segments = parsePath(path)
  if (segments.length === 0) return "General"

  if (segments[0] === "rows" && typeof segments[1] === "number") return `Row ${segments[1] + 1}`
  if (segments[0] === "entries" && typeof segments[1] === "number") return `Entry ${segments[1] + 1}`
  if (segments[0] === "cases" && typeof segments[1] === "number") return `Case ${segments[1] + 1}`
  if (segments[0] === "signatures") return "Signatures"
  if (
    (segments[0] === "initials_signatures" ||
      segments[0] === "checks" ||
      segments[0] === "notes" ||
      segments[0] === "initials") &&
    typeof segments[1] === "string" &&
    /^\d+$/.test(segments[1])
  ) {
    return `Day ${segments[1]}`
  }
  if (segments[0] === "lock_changes") return "Lock changes"
  if (segments[0] === "lock_digits") return "Lock code"
  if (segments[0] === "top_of_cart") return "Top of cart"
  if (segments[0] === "months" && typeof segments[1] === "string") return `Month ${segments[1].toUpperCase()}`

  return "General"
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "blank"
  if (typeof value === "boolean") return value ? "Checked" : "Unchecked"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (obj.state === "present") return "signature present"
    if (obj.state === "blank") return "blank"
    if (typeof obj.blank === "boolean") return obj.blank ? "blank" : "updated"
    return "updated"
  }
  return String(value)
}

export function formatAuditValue(
  _logType: LogEntryAuditLogType,
  _path: string,
  value: unknown,
  role?: Role | null
): string {
  void role
  return valueText(value)
}

function signatureChangeText(change: LogEntryAuditChange): string {
  const oldState = (change.oldValue as Record<string, unknown> | undefined)?.state
  const newState = (change.newValue as Record<string, unknown> | undefined)?.state
  if (oldState === "blank" && newState === "present") return "Signature added"
  if (oldState === "present" && newState === "blank") return "Signature cleared"
  if (oldState === "present" && newState === "present") return "Signature replaced"
  return "Signature updated"
}

function changeText(logType: LogEntryAuditLogType, change: LogEntryAuditChange, role?: Role | null): string {
  const label = labelForPath(logType, change.path)

  if (change.redacted) {
    if (change.mode === "SIGNATURE_META") return signatureChangeText(change)
    if (change.mode === "SECRET_REDACT") return `${label} changed`
    return `${label} updated`
  }

  if (change.path === "status") {
    return `${label}: ${formatAuditValue(logType, change.path, change.oldValue, role)} -> ${formatAuditValue(logType, change.path, change.newValue, role)}`
  }

  if (change.kind === "add") return `${label}: ${formatAuditValue(logType, change.path, change.newValue, role)}`
  if (change.kind === "remove") return `${label} cleared`
  return `${label}: ${formatAuditValue(logType, change.path, change.oldValue, role)} -> ${formatAuditValue(logType, change.path, change.newValue, role)}`
}

export function humanizeAuditChanges(logType: LogEntryAuditLogType, changes: LogEntryAuditChange[], role?: Role | null) {
  const items: HumanizedAuditChange[] = changes.map((change) => ({
    path: change.path,
    group: groupForPath(change.path),
    label: labelForPath(logType, change.path),
    text: changeText(logType, change, role),
  }))

  const groupMap = new Map<string, HumanizedAuditChange[]>()
  for (const item of items) {
    const arr = groupMap.get(item.group) ?? []
    arr.push(item)
    groupMap.set(item.group, arr)
  }

  return {
    changes: items,
    groups: Array.from(groupMap.entries()).map(([title, grouped]) => ({
      title,
      changes: grouped,
    })),
  }
}

function eventLabel(eventType: LogEntryAuditEventType): string {
  switch (eventType) {
    case "created":
      return "Created record"
    case "updated":
      return "Saved changes"
    case "submitted_complete":
      return "Finalized record"
    case "reverted_draft":
      return "Reverted to draft"
    case "deleted":
      return "Deleted record"
  }
}

export function humanizeAuditEventSummary(params: {
  actorName: string
  eventType: LogEntryAuditEventType
  changeCount: number
}) {
  const { actorName, eventType, changeCount } = params
  const action =
    eventType === "created"
      ? "created this record"
      : eventType === "updated"
        ? "saved changes"
        : eventType === "submitted_complete"
          ? "finalized this record"
          : eventType === "reverted_draft"
            ? "reverted this record to draft"
            : "deleted this record"

  return `${actorName} ${action}${changeCount > 0 ? ` (${changeCount} change${changeCount === 1 ? "" : "s"})` : ""}`
}

export function humanizeLogEntryAuditEvent(event: LogEntryAuditEvent, requesterRole?: Role | null): HumanizedAuditEvent {
  const actorName = event.actor_name?.trim() || "Someone"
  const payload = event.payload ?? {}
  const machineChanges = Array.isArray(payload.changes) ? (payload.changes as LogEntryAuditChange[]) : []
  const { changes, groups } = humanizeAuditChanges(event.log_type, machineChanges, requesterRole)

  return {
    id: event.id,
    eventType: event.event_type,
    eventLabel: eventLabel(event.event_type),
    actorName,
    actorRole: event.actor_role,
    at: event.event_at,
    summaryText: humanizeAuditEventSummary({
      actorName,
      eventType: event.event_type,
      changeCount: changes.length,
    }),
    changes,
    groups,
  }
}
