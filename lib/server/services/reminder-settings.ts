import "server-only"
import { unstable_cache } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type {
  ReminderSettings,
  UpdateReminderSettingsInput,
} from "@/lib/validations/reminder-settings"

async function fetchReminderSettings(): Promise<ReminderSettings> {
  const { data, error } = await supabase
    .from("reminder_settings")
    .select("*")
    .limit(1)
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data
}

export const getReminderSettings = unstable_cache(
  fetchReminderSettings,
  ["reminder-settings"],
  { revalidate: 60, tags: ["reminder-settings"] }
)

export async function updateReminderSettings({
  userId,
  input,
}: {
  userId: string
  input: UpdateReminderSettingsInput
}): Promise<ReminderSettings> {
  // First get the singleton row id
  const { data: current, error: fetchError } = await supabase
    .from("reminder_settings")
    .select("id")
    .limit(1)
    .single()

  if (fetchError || !current) {
    throw new ApiError("INTERNAL_ERROR", "Reminder settings not found")
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }

  if (input.weekly_due_day !== undefined) updateData.weekly_due_day = input.weekly_due_day
  if (input.monthly_days_before !== undefined) updateData.monthly_days_before = input.monthly_days_before
  if (input.monthly_due_day !== undefined) updateData.monthly_due_day = input.monthly_due_day
  if (input.yearly_months_before !== undefined) updateData.yearly_months_before = input.yearly_months_before
  if (input.yearly_monthly_reminder !== undefined) updateData.yearly_monthly_reminder = input.yearly_monthly_reminder
  if (input.yearly_due_day !== undefined) updateData.yearly_due_day = input.yearly_due_day
  if (input.three_year_months_before !== undefined) updateData.three_year_months_before = input.three_year_months_before
  if (input.three_year_monthly_reminder !== undefined) updateData.three_year_monthly_reminder = input.three_year_monthly_reminder
  if (input.three_year_due_day !== undefined) updateData.three_year_due_day = input.three_year_due_day

  const { data, error } = await supabase
    .from("reminder_settings")
    .update(updateData)
    .eq("id", current.id)
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data
}
