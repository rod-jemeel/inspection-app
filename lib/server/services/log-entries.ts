import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import { validateLogData } from "@/lib/validations/log-entry"
import type {
  UpsertLogEntryInput,
  FilterLogEntriesInput,
} from "@/lib/validations/log-entry"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogEntry {
  id: string
  location_id: string
  log_type: string
  log_key: string
  log_date: string
  data: Record<string, unknown>
  submitted_by_profile_id: string
  status: "draft" | "complete"
  created_at: string
  updated_at: string
  // Enriched
  submitted_by_name?: string | null
}

// ---------------------------------------------------------------------------
// Upsert (create or update)
// ---------------------------------------------------------------------------

export async function upsertLogEntry(
  locationId: string,
  profileId: string,
  input: UpsertLogEntryInput
): Promise<LogEntry> {
  // Validate the JSONB data against the log-type-specific schema
  const validatedData = validateLogData(input.log_type, input.data)

  const { data, error } = await supabase
    .from("log_entries")
    .upsert(
      {
        location_id: locationId,
        log_type: input.log_type,
        log_key: input.log_key,
        log_date: input.log_date,
        data: validatedData as Record<string, unknown>,
        submitted_by_profile_id: profileId,
        status: input.status,
      },
      { onConflict: "location_id,log_type,log_key,log_date" }
    )
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as LogEntry
}

// ---------------------------------------------------------------------------
// Get single by key (for perpetual logs)
// ---------------------------------------------------------------------------

export async function getLogEntryByKey(
  locationId: string,
  logType: string,
  logKey: string
): Promise<LogEntry | null> {
  const { data, error } = await supabase
    .from("log_entries")
    .select(`
      *,
      submitted_by:profiles!log_entries_submitted_by_profile_id_fkey(full_name)
    `)
    .eq("location_id", locationId)
    .eq("log_type", logType)
    .eq("log_key", logKey)
    .maybeSingle()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  if (!data) return null

  const row = data as Record<string, unknown>
  const submittedBy = row.submitted_by as { full_name: string } | null

  return {
    id: row.id as string,
    location_id: row.location_id as string,
    log_type: row.log_type as string,
    log_key: row.log_key as string,
    log_date: row.log_date as string,
    data: row.data as Record<string, unknown>,
    submitted_by_profile_id: row.submitted_by_profile_id as string,
    status: row.status as "draft" | "complete",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    submitted_by_name: submittedBy?.full_name ?? null,
  }
}

// ---------------------------------------------------------------------------
// Get single by date
// ---------------------------------------------------------------------------

export async function getLogEntryByDate(
  locationId: string,
  logType: string,
  logDate: string
): Promise<LogEntry | null> {
  const { data, error } = await supabase
    .from("log_entries")
    .select(`
      *,
      submitted_by:profiles!log_entries_submitted_by_profile_id_fkey(full_name)
    `)
    .eq("location_id", locationId)
    .eq("log_type", logType)
    .eq("log_date", logDate)
    .maybeSingle()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  if (!data) return null

  const row = data as Record<string, unknown>
  const submittedBy = row.submitted_by as { full_name: string } | null

  return {
    id: row.id as string,
    location_id: row.location_id as string,
    log_type: row.log_type as string,
    log_key: row.log_key as string,
    log_date: row.log_date as string,
    data: row.data as Record<string, unknown>,
    submitted_by_profile_id: row.submitted_by_profile_id as string,
    status: row.status as "draft" | "complete",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    submitted_by_name: submittedBy?.full_name ?? null,
  }
}

// ---------------------------------------------------------------------------
// Get single by ID
// ---------------------------------------------------------------------------

export async function getLogEntry(
  locationId: string,
  logId: string
): Promise<LogEntry> {
  const { data, error } = await supabase
    .from("log_entries")
    .select(`
      *,
      submitted_by:profiles!log_entries_submitted_by_profile_id_fkey(full_name)
    `)
    .eq("id", logId)
    .eq("location_id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Log entry not found")

  const row = data as Record<string, unknown>
  const submittedBy = row.submitted_by as { full_name: string } | null

  return {
    id: row.id as string,
    location_id: row.location_id as string,
    log_type: row.log_type as string,
    log_key: row.log_key as string,
    log_date: row.log_date as string,
    data: row.data as Record<string, unknown>,
    submitted_by_profile_id: row.submitted_by_profile_id as string,
    status: row.status as "draft" | "complete",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    submitted_by_name: submittedBy?.full_name ?? null,
  }
}

// ---------------------------------------------------------------------------
// List with filters
// ---------------------------------------------------------------------------

export async function listLogEntries(
  locationId: string,
  filters: FilterLogEntriesInput
): Promise<{ entries: LogEntry[]; total: number }> {
  let query = supabase
    .from("log_entries")
    .select(`
      *,
      submitted_by:profiles!log_entries_submitted_by_profile_id_fkey(full_name)
    `, { count: "exact" })
    .eq("location_id", locationId)
    .eq("log_type", filters.log_type)
    .order("log_date", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (filters.from) query = query.gte("log_date", filters.from)
  if (filters.to) query = query.lte("log_date", filters.to)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.log_key !== undefined) query = query.eq("log_key", filters.log_key)

  const { data, error, count } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  const entries = (data ?? []).map((row: Record<string, unknown>) => {
    const submittedBy = row.submitted_by as { full_name: string } | null
    return {
      id: row.id as string,
      location_id: row.location_id as string,
      log_type: row.log_type as string,
      log_key: row.log_key as string,
      log_date: row.log_date as string,
      data: row.data as Record<string, unknown>,
      submitted_by_profile_id: row.submitted_by_profile_id as string,
      status: row.status as "draft" | "complete",
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      submitted_by_name: submittedBy?.full_name ?? null,
    }
  })

  return { entries, total: count ?? 0 }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteLogEntry(
  locationId: string,
  logId: string
): Promise<void> {
  const { error } = await supabase
    .from("log_entries")
    .delete()
    .eq("id", logId)
    .eq("location_id", locationId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
}
