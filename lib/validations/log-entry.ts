import { z } from "zod"

// ---------------------------------------------------------------------------
// Log entry status
// ---------------------------------------------------------------------------

export const logStatusEnum = z.enum(["draft", "complete"])
export type LogStatus = z.infer<typeof logStatusEnum>

// ---------------------------------------------------------------------------
// Narcotic Log data shape (stored as JSONB in log_entries.data)
// ---------------------------------------------------------------------------

const narcoticRowSchema = z.object({
  patient: z.string().default(""),
  versed: z.number().nullable().default(null),
  versed_waste: z.number().nullable().default(null),
  fentanyl: z.number().nullable().default(null),
  fentanyl_waste: z.number().nullable().default(null),
  drug3: z.number().nullable().default(null),
  drug3_waste: z.number().nullable().default(null),
  sig1: z.string().nullable().default(null),
  sig2: z.string().nullable().default(null),
})

export type NarcoticRow = z.infer<typeof narcoticRowSchema>

const narcoticCountSchema = z.object({
  versed: z.number().nullable().default(null),
  fentanyl: z.number().nullable().default(null),
  drug3: z.number().nullable().default(null),
})

const narcoticEndCountSchema = z.object({
  versed: z.number().nullable().default(null),
  versed_total_waste: z.number().nullable().default(null),
  fentanyl: z.number().nullable().default(null),
  fentanyl_total_waste: z.number().nullable().default(null),
  drug3: z.number().nullable().default(null),
  drug3_total_waste: z.number().nullable().default(null),
})

export const narcoticLogDataSchema = z.object({
  drug3_name: z.string().default(""),
  header_sig1: z.string().nullable().default(null),
  header_sig2: z.string().nullable().default(null),
  beginning_count: narcoticCountSchema.default({ versed: null, fentanyl: null, drug3: null }),
  rows: z.array(narcoticRowSchema).min(1).max(50).default([{
    patient: "",
    versed: null,
    versed_waste: null,
    fentanyl: null,
    fentanyl_waste: null,
    drug3: null,
    drug3_waste: null,
    sig1: null,
    sig2: null,
  }]),
  end_count: narcoticEndCountSchema.default({ versed: null, versed_total_waste: null, fentanyl: null, fentanyl_total_waste: null, drug3: null, drug3_total_waste: null }),
  end_sig1: z.string().nullable().default(null),
  end_sig2: z.string().nullable().default(null),
})

export type NarcoticLogData = z.infer<typeof narcoticLogDataSchema>

// ---------------------------------------------------------------------------
// Upsert input (POST body)
// ---------------------------------------------------------------------------

export const upsertLogEntrySchema = z.object({
  log_type: z.literal("narcotic_log"),
  log_date: z.string().date(),
  data: z.record(z.string(), z.unknown()),
  status: logStatusEnum.default("draft"),
})

export type UpsertLogEntryInput = z.infer<typeof upsertLogEntrySchema>

// ---------------------------------------------------------------------------
// Filter input (GET query params)
// ---------------------------------------------------------------------------

export const filterLogEntriesSchema = z.object({
  log_type: z.string().default("narcotic_log"),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  status: logStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type FilterLogEntriesInput = z.infer<typeof filterLogEntriesSchema>

// ---------------------------------------------------------------------------
// Per-type data validation
// ---------------------------------------------------------------------------

export function validateLogData(logType: string, data: unknown): unknown {
  switch (logType) {
    case "narcotic_log":
      return narcoticLogDataSchema.parse(data)
    default:
      throw new Error(`Unknown log type: ${logType}`)
  }
}

// ---------------------------------------------------------------------------
// Default empty narcotic log data
// ---------------------------------------------------------------------------

const BLANK_ROW: NarcoticRow = {
  patient: "",
  versed: null,
  versed_waste: null,
  fentanyl: null,
  fentanyl_waste: null,
  drug3: null,
  drug3_waste: null,
  sig1: null,
  sig2: null,
}

/** Paper form has 12 rows per page */
const DEFAULT_ROW_COUNT = 12

export function emptyNarcoticLogData(): NarcoticLogData {
  return {
    drug3_name: "",
    header_sig1: null,
    header_sig2: null,
    beginning_count: { versed: null, fentanyl: null, drug3: null },
    rows: Array.from({ length: DEFAULT_ROW_COUNT }, () => ({ ...BLANK_ROW })),
    end_count: {
      versed: null,
      versed_total_waste: null,
      fentanyl: null,
      fentanyl_total_waste: null,
      drug3: null,
      drug3_total_waste: null,
    },
    end_sig1: null,
    end_sig2: null,
  }
}
