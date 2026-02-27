import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { Role } from "@/lib/permissions"
import type { LogEntryAuditLogType } from "@/lib/validations/log-entry-events"
import type { LogEntryAuditChange, LogEntryAuditSummary } from "./log-entry-diff"

export type LogEntryAuditEventType =
  | "created"
  | "updated"
  | "submitted_complete"
  | "reverted_draft"
  | "deleted"

export interface LogEntryAuditPayload {
  changes?: LogEntryAuditChange[]
  summary?: LogEntryAuditSummary | Record<string, unknown>
  meta?: Record<string, unknown>
  [key: string]: unknown
}

export interface LogEntryAuditEvent {
  id: string
  log_entry_id: string | null
  location_id: string
  log_type: LogEntryAuditLogType
  log_key: string
  log_date: string
  event_type: LogEntryAuditEventType
  actor_profile_id: string | null
  actor_name: string | null
  actor_role: Role | null
  event_at: string
  payload: LogEntryAuditPayload
}

export async function appendLogEntryEvent(input: {
  log_entry_id: string | null
  location_id: string
  log_type: LogEntryAuditLogType
  log_key: string
  log_date: string
  event_type: LogEntryAuditEventType
  actor_profile_id: string | null
  payload: LogEntryAuditPayload
}) {
  const { data, error } = await supabase
    .from("log_entry_events")
    .insert(input)
    .select("id")
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as { id: string }
}

export async function listLogEntryEventsByIdentity(params: {
  locationId: string
  logType: LogEntryAuditLogType
  logKey: string
  logDate: string
  limit?: number
  offset?: number
}) {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
  const offset = Math.max(params.offset ?? 0, 0)

  const { data, error, count } = await supabase
    .from("log_entry_events")
    .select(
      `
      id,
      log_entry_id,
      location_id,
      log_type,
      log_key,
      log_date,
      event_type,
      actor_profile_id,
      event_at,
      payload,
      actor:profiles!log_entry_events_actor_profile_id_fkey(full_name, role)
    `,
      { count: "exact" }
    )
    .eq("location_id", params.locationId)
    .eq("log_type", params.logType)
    .eq("log_key", params.logKey)
    .eq("log_date", params.logDate)
    .order("event_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  const events = (data ?? []).map((row: Record<string, unknown>) => {
    const actor = row.actor as { full_name?: string | null; role?: Role | null } | null
    return {
      id: row.id as string,
      log_entry_id: (row.log_entry_id as string | null) ?? null,
      location_id: row.location_id as string,
      log_type: row.log_type as LogEntryAuditLogType,
      log_key: (row.log_key as string) ?? "",
      log_date: row.log_date as string,
      event_type: row.event_type as LogEntryAuditEventType,
      actor_profile_id: (row.actor_profile_id as string | null) ?? null,
      actor_name: actor?.full_name ?? null,
      actor_role: actor?.role ?? null,
      event_at: row.event_at as string,
      payload: (row.payload as LogEntryAuditPayload) ?? {},
    } satisfies LogEntryAuditEvent
  })

  return { events, total: count ?? 0 }
}

export async function listLogEntryEventsByLogId(params: {
  locationId: string
  logEntryId: string
  limit?: number
  offset?: number
}) {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
  const offset = Math.max(params.offset ?? 0, 0)

  const { data, error, count } = await supabase
    .from("log_entry_events")
    .select(
      `
      id,
      log_entry_id,
      location_id,
      log_type,
      log_key,
      log_date,
      event_type,
      actor_profile_id,
      event_at,
      payload,
      actor:profiles!log_entry_events_actor_profile_id_fkey(full_name, role)
    `,
      { count: "exact" }
    )
    .eq("location_id", params.locationId)
    .eq("log_entry_id", params.logEntryId)
    .order("event_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  const events = (data ?? []).map((row: Record<string, unknown>) => {
    const actor = row.actor as { full_name?: string | null; role?: Role | null } | null
    return {
      id: row.id as string,
      log_entry_id: (row.log_entry_id as string | null) ?? null,
      location_id: row.location_id as string,
      log_type: row.log_type as LogEntryAuditLogType,
      log_key: (row.log_key as string) ?? "",
      log_date: row.log_date as string,
      event_type: row.event_type as LogEntryAuditEventType,
      actor_profile_id: (row.actor_profile_id as string | null) ?? null,
      actor_name: actor?.full_name ?? null,
      actor_role: actor?.role ?? null,
      event_at: row.event_at as string,
      payload: (row.payload as LogEntryAuditPayload) ?? {},
    } satisfies LogEntryAuditEvent
  })

  return { events, total: count ?? 0 }
}
