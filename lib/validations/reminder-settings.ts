import { z } from "zod"

export interface ReminderSettings {
  id: string
  weekly_due_day: boolean
  monthly_days_before: number
  monthly_due_day: boolean
  yearly_months_before: number
  yearly_monthly_reminder: boolean
  yearly_due_day: boolean
  three_year_months_before: number
  three_year_monthly_reminder: boolean
  three_year_due_day: boolean
  updated_at: string
  updated_by: string | null
}

export const updateReminderSettingsSchema = z.object({
  weekly_due_day: z.boolean().optional(),
  monthly_days_before: z.number().int().min(1).max(30).optional(),
  monthly_due_day: z.boolean().optional(),
  yearly_months_before: z.number().int().min(1).max(12).optional(),
  yearly_monthly_reminder: z.boolean().optional(),
  yearly_due_day: z.boolean().optional(),
  three_year_months_before: z.number().int().min(1).max(12).optional(),
  three_year_monthly_reminder: z.boolean().optional(),
  three_year_due_day: z.boolean().optional(),
})

export type UpdateReminderSettingsInput = z.infer<typeof updateReminderSettingsSchema>
