import { z } from "zod"

export const logEntryEventLogTypeEnum = z.enum([
  "narcotic_log",
  "controlled_substance_inventory",
  "crash_cart_checklist",
  "narcotic_signout",
  "daily_narcotic_count",
  "cardiac_arrest_record",
  "crash_cart_daily",
])

export const listLogEntryEventsQuerySchema = z.object({
  log_type: logEntryEventLogTypeEnum,
  log_key: z.string().default(""),
  log_date: z.string().date(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type ListLogEntryEventsQueryInput = z.infer<typeof listLogEntryEventsQuerySchema>
export type LogEntryAuditLogType = z.infer<typeof logEntryEventLogTypeEnum>
