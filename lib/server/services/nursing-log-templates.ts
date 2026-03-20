import "server-only"
import { supabase } from "@/lib/server/db"

/**
 * Log types that need scheduled inspection instances.
 * Excludes controlled_substance_inventory (perpetual ledger) and
 * cardiac_arrest_record (event-driven) since those don't need scheduled instances.
 */
const NURSING_LOG_TEMPLATES = [
  {
    name: "Narcotic Log",
    log_type: "narcotic_log",
    frequency: "daily" as const,
    description: "Daily controlled substance narcotic log",
  },
  {
    name: "Narcotic Sign-Out",
    log_type: "narcotic_signout",
    frequency: "daily" as const,
    description: "Daily narcotic sign-out record",
  },
  {
    name: "Crash Cart Daily Check",
    log_type: "crash_cart_daily",
    frequency: "monthly" as const,
    description: "Monthly crash cart daily checklist",
  },
  {
    name: "Daily Narcotic Count",
    log_type: "daily_narcotic_count",
    frequency: "monthly" as const,
    description: "Monthly daily narcotic count log",
  },
  {
    name: "Crash Cart Checklist",
    log_type: "crash_cart_checklist",
    frequency: "yearly" as const,
    description: "Annual crash cart full inspection checklist",
  },
] as const

/**
 * Seeds nursing log form_templates for a location if they don't already exist.
 * Called on location creation and can be safely re-run (idempotent via upsert).
 */
export async function seedNursingLogTemplates(locationId: string): Promise<void> {
  // Check which log types already have templates for this location
  const { data: existing } = await supabase
    .from("form_templates")
    .select("log_type")
    .eq("location_id", locationId)
    .not("log_type", "is", null)

  const existingLogTypes = new Set((existing ?? []).map((r) => r.log_type))

  const toInsert = NURSING_LOG_TEMPLATES.filter(
    (t) => !existingLogTypes.has(t.log_type)
  )

  if (toInsert.length === 0) return

  const { error } = await supabase.from("form_templates").insert(
    toInsert.map((t) => ({
      location_id: locationId,
      name: t.name,
      log_type: t.log_type,
      frequency: t.frequency,
      description: t.description,
      binder_id: null,
      scheduling_active: true,
      active: true,
    }))
  )

  if (error) {
    console.error(`Failed to seed nursing log templates for location ${locationId}:`, error)
  }
}
