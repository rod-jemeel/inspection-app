import { z } from "zod"

export const exportableLogTypeEnum = z.enum([
  "narcotic_log",
  "narcotic_signout",
  "cardiac_arrest_record",
  "daily_narcotic_count",
  "crash_cart_daily",
  "crash_cart_checklist",
  "controlled_substance_inventory",
])

export type ExportableLogType = z.infer<typeof exportableLogTypeEnum>

const sortEnum = z.enum(["asc", "desc"]).default("asc")
const dateString = z.string().date()
const monthString = z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM")

const commonFields = {
  includeDrafts: z.boolean().optional().default(false),
  sort: sortEnum.optional().default("asc"),
}

const dateRangeExportSchema = z.object({
  logType: z.enum(["narcotic_log", "narcotic_signout", "cardiac_arrest_record"]),
  dateFrom: dateString,
  dateTo: dateString,
  ...commonFields,
})

const dailyNarcoticCountExportSchema = z.object({
  logType: z.literal("daily_narcotic_count"),
  monthFrom: monthString,
  monthTo: monthString,
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  ...commonFields,
})

const crashCartDailyExportSchema = z.object({
  logType: z.literal("crash_cart_daily"),
  monthFrom: monthString,
  monthTo: monthString,
  ...commonFields,
})

const yearRangeExportSchema = z.object({
  logType: z.literal("crash_cart_checklist"),
  yearFrom: z.number().int().min(2000).max(2100),
  yearTo: z.number().int().min(2000).max(2100),
  ...commonFields,
})

const inventoryExportSchema = z.object({
  logType: z.literal("controlled_substance_inventory"),
  dateFrom: dateString,
  dateTo: dateString,
  drugSlugs: z.array(z.string().min(1)).max(100).optional(),
  rowRangeMode: z.literal("rows_only").optional().default("rows_only"),
  ...commonFields,
})

export const exportLogPdfRequestSchema = z.union([
  dateRangeExportSchema,
  dailyNarcoticCountExportSchema,
  crashCartDailyExportSchema,
  yearRangeExportSchema,
  inventoryExportSchema,
]).superRefine((value, ctx) => {
  if (value.logType === "daily_narcotic_count") {
    const hasDateFrom = typeof value.dateFrom === "string"
    const hasDateTo = typeof value.dateTo === "string"
    if (hasDateFrom !== hasDateTo) {
      ctx.addIssue({
        code: "custom",
        path: hasDateFrom ? ["dateTo"] : ["dateFrom"],
        message: "Both dateFrom and dateTo are required when filtering daily rows by date",
      })
    }
  }
  if ("dateFrom" in value && "dateTo" in value && typeof value.dateFrom === "string" && typeof value.dateTo === "string" && value.dateFrom > value.dateTo) {
    ctx.addIssue({ code: "custom", path: ["dateTo"], message: "dateTo must be on or after dateFrom" })
  }
  if ("monthFrom" in value && "monthTo" in value && value.monthFrom > value.monthTo) {
    ctx.addIssue({ code: "custom", path: ["monthTo"], message: "monthTo must be on or after monthFrom" })
  }
  if ("yearFrom" in value && "yearTo" in value && value.yearFrom > value.yearTo) {
    ctx.addIssue({ code: "custom", path: ["yearTo"], message: "yearTo must be on or after yearFrom" })
  }
})

export type ExportLogPdfRequest = z.infer<typeof exportLogPdfRequestSchema>

export interface SignatureAsset {
  bytes: Uint8Array
  mimeType: "image/png" | "image/jpeg"
  source: "data-url" | "supabase-path"
}

export interface LogExportRecordRef {
  id: string
  logType: ExportableLogType
  logKey: string
  logDate: string
  status: "draft" | "complete"
  data: Record<string, unknown>
  submittedByName: string | null
}

export interface TemplateFieldSpec {
  x: number
  y: number
  width?: number
  height?: number
  fontSize?: number
  align?: "left" | "center" | "right"
}

export interface RowGridSpec {
  startX: number
  startY: number
  rowHeight: number
  columns: Record<string, { x: number; width: number; align?: "left" | "center" | "right" }>
}

export interface PageSpec {
  width: number
  height: number
  visualRotation?: 0 | 90 | 180 | 270
}

export interface RenderedPdfPart {
  bytes: Uint8Array
  pageCount: number
  description: string
}
