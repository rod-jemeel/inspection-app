import "server-only"
import { ApiError } from "@/lib/server/errors"
import { listLogEntries, type LogEntry } from "@/lib/server/services/log-entries"
import type { ExportLogPdfRequest } from "@/lib/validations/log-export"
import {
  cardiacArrestRecordDataSchema,
  crashCartDailyLogDataSchema,
  crashCartLogDataSchema,
  dailyNarcoticCountLogDataSchema,
  inventoryLogDataSchema,
  narcoticLogDataSchema,
  narcoticSignoutLogDataSchema,
  type InventoryLogData,
} from "@/lib/validations/log-entry"
import { monthInRange, parseInventoryRowDate, yearKeyInRange } from "@/lib/server/log-pdf/date-key-utils"
import { createRenderContext } from "@/lib/server/log-pdf"
import { mergePdfBytes } from "@/lib/server/log-pdf/pdf-utils"
import { templateLabelForLogType } from "@/lib/server/log-pdf/template-registry"
import { narcoticLogRenderer } from "@/lib/server/log-pdf/renderers/narcotic-log"
import { narcoticSignoutRenderer } from "@/lib/server/log-pdf/renderers/narcotic-signout"
import { cardiacArrestRenderer } from "@/lib/server/log-pdf/renderers/cardiac-arrest"
import { narcoticCountRenderer } from "@/lib/server/log-pdf/renderers/narcotic-count"
import { crashCartDailyRenderer } from "@/lib/server/log-pdf/renderers/crash-cart-daily"
import { crashCartMonthlyRenderer } from "@/lib/server/log-pdf/renderers/crash-cart-monthly"
import { inventoryRenderer } from "@/lib/server/log-pdf/renderers/inventory"

const MAX_RECORDS = 250
const MAX_PAGES = 500

async function listAllLogEntriesForType(
  locationId: string,
  logType: string,
  opts?: { from?: string; to?: string; status?: "draft" | "complete" }
): Promise<LogEntry[]> {
  const all: LogEntry[] = []
  let offset = 0
  let total = 1

  while (offset < total) {
    const { entries, total: count } = await listLogEntries(locationId, {
      log_type: logType,
      from: opts?.from,
      to: opts?.to,
      status: opts?.status,
      limit: 100,
      offset,
    })
    all.push(...entries)
    total = count
    offset += entries.length
    if (entries.length === 0) break
    if (all.length > MAX_RECORDS * 4) break
  }

  return all
}

function sortEntries(entries: LogEntry[], sort: "asc" | "desc") {
  entries.sort((a, b) => {
    const cmp = `${a.log_date}|${a.log_key}|${a.id}`.localeCompare(`${b.log_date}|${b.log_key}|${b.id}`)
    return sort === "asc" ? cmp : -cmp
  })
}

function parseVialVolume(sizeQty: string): number | null {
  const match = sizeQty.match(/([\d.]+)\s*m[lL]/i)
  return match ? Number.parseFloat(match[1]) : null
}

function computeCarryForwardStock(data: InventoryLogData, fromDate: string): number | null {
  let stock = data.initial_stock ?? null
  const vialVol = parseVialVolume(data.size_qty)
  for (const row of data.rows ?? []) {
    const dt = parseInventoryRowDate(row.date)
    if (!dt) continue
    const iso = dt.toISOString().slice(0, 10)
    if (iso >= fromDate) break

    if (row.qty_in_stock !== null) {
      stock = row.qty_in_stock
      continue
    }

    if (stock === null) stock = 0
    const vialsConsumed = vialVol && row.amt_used ? Math.ceil(row.amt_used / vialVol) : 0
    stock = stock + (row.amt_ordered ?? 0) - vialsConsumed
  }
  return stock
}

function buildFileName(req: ExportLogPdfRequest) {
  const base = req.logType.replaceAll("_", "-")
  if ("dateFrom" in req && "dateTo" in req) return `${base}-${req.dateFrom}-to-${req.dateTo}.pdf`
  if ("monthFrom" in req && "monthTo" in req) return `${base}-${req.monthFrom}-to-${req.monthTo}.pdf`
  return `${base}-${req.yearFrom}-to-${req.yearTo}.pdf`
}

export async function buildLogExportPdf(locationId: string, request: ExportLogPdfRequest) {
  const renderCtx = createRenderContext(process.env.LOG_PDF_DEBUG === "1")
  const requiredStatus = request.includeDrafts ? undefined : "complete"
  const renderedParts: Uint8Array[] = []
  let totalPages = 0
  let renderedRecordCount = 0

  async function addRendered(partPromise: Promise<{ bytes: Uint8Array; pageCount: number }>) {
    const part = await partPromise
    renderedParts.push(part.bytes)
    totalPages += part.pageCount
    if (totalPages > MAX_PAGES) {
      throw new ApiError("VALIDATION_ERROR", `Export exceeds max page limit (${MAX_PAGES})`)
    }
  }

  switch (request.logType) {
    case "narcotic_log":
    case "narcotic_signout":
    case "cardiac_arrest_record": {
      const entries = await listAllLogEntriesForType(locationId, request.logType, {
        from: request.dateFrom,
        to: request.dateTo,
        status: requiredStatus,
      })
      sortEntries(entries, request.sort)
      if (entries.length === 0) throw new ApiError("VALIDATION_ERROR", "No saved logs found for that range")
      if (entries.length > MAX_RECORDS) throw new ApiError("VALIDATION_ERROR", `Export exceeds max record limit (${MAX_RECORDS})`)

      for (const entry of entries) {
        renderedRecordCount += 1
        if (request.logType === "narcotic_log") {
          const data = narcoticLogDataSchema.parse(entry.data)
          await addRendered(narcoticLogRenderer.render({ entry, data }, renderCtx))
        } else if (request.logType === "narcotic_signout") {
          const data = narcoticSignoutLogDataSchema.parse(entry.data)
          await addRendered(narcoticSignoutRenderer.render({ entry, data }, renderCtx))
        } else {
          const data = cardiacArrestRecordDataSchema.parse(entry.data)
          await addRendered(cardiacArrestRenderer.render({ entry, data }, renderCtx))
        }
      }
      break
    }
    case "daily_narcotic_count":
    case "crash_cart_daily": {
      const entries = await listAllLogEntriesForType(locationId, request.logType, { status: requiredStatus })
      const filtered = entries.filter((e) => monthInRange(e.log_key, request.monthFrom, request.monthTo))
      sortEntries(filtered, request.sort)
      if (filtered.length === 0) throw new ApiError("VALIDATION_ERROR", "No saved logs found for that range")
      if (filtered.length > MAX_RECORDS) throw new ApiError("VALIDATION_ERROR", `Export exceeds max record limit (${MAX_RECORDS})`)

      for (const entry of filtered) {
        if (request.logType === "daily_narcotic_count") {
          const data = dailyNarcoticCountLogDataSchema.parse(entry.data)
          let exportData = data

          if (request.dateFrom && request.dateTo) {
            const rowsInRange = (data.entries ?? []).filter((row) => {
              const dt = parseInventoryRowDate(row.date)
              if (!dt) return false
              const iso = dt.toISOString().slice(0, 10)
              return iso >= request.dateFrom! && iso <= request.dateTo!
            })
            if (rowsInRange.length === 0) continue
            exportData = {
              ...data,
              from_date: request.dateFrom,
              to_date: request.dateTo,
              entries: rowsInRange,
            }
          }

          renderedRecordCount += 1
          await addRendered(narcoticCountRenderer.render({ entry, data: exportData }, renderCtx))
        } else {
          renderedRecordCount += 1
          const data = crashCartDailyLogDataSchema.parse(entry.data)
          await addRendered(crashCartDailyRenderer.render({ entry, data }, renderCtx))
        }
      }
      if (renderedRecordCount === 0) {
        if (request.logType === "daily_narcotic_count" && request.dateFrom && request.dateTo) {
          throw new ApiError("VALIDATION_ERROR", "No saved daily narcotic count rows found for that date range")
        }
      }
      break
    }
    case "crash_cart_checklist": {
      const entries = await listAllLogEntriesForType(locationId, request.logType, { status: requiredStatus })
      const filtered = entries.filter((e) => yearKeyInRange(e.log_key, request.yearFrom, request.yearTo))
      sortEntries(filtered, request.sort)
      if (filtered.length === 0) throw new ApiError("VALIDATION_ERROR", "No saved logs found for that range")
      if (filtered.length > MAX_RECORDS) throw new ApiError("VALIDATION_ERROR", `Export exceeds max record limit (${MAX_RECORDS})`)

      for (const entry of filtered) {
        renderedRecordCount += 1
        const data = crashCartLogDataSchema.parse(entry.data)
        await addRendered(crashCartMonthlyRenderer.render({ entry, data }, renderCtx))
      }
      break
    }
    case "controlled_substance_inventory": {
      const entries = await listAllLogEntriesForType(locationId, request.logType, { status: requiredStatus })
      let filtered = entries
      if (request.drugSlugs && request.drugSlugs.length > 0) {
        const allowed = new Set(request.drugSlugs)
        filtered = filtered.filter((e) => allowed.has(e.log_key))
      }
      filtered.sort((a, b) => request.sort === "asc" ? a.log_key.localeCompare(b.log_key) : b.log_key.localeCompare(a.log_key))
      if (filtered.length === 0) throw new ApiError("VALIDATION_ERROR", "No saved inventory ledgers found")
      if (filtered.length > MAX_RECORDS) throw new ApiError("VALIDATION_ERROR", `Export exceeds max record limit (${MAX_RECORDS})`)

      let anyRows = false
      for (const entry of filtered) {
        const data = inventoryLogDataSchema.parse(entry.data)
        const rows = (data.rows ?? []).filter((row) => {
          const dt = parseInventoryRowDate(row.date)
          if (!dt) return false
          const iso = dt.toISOString().slice(0, 10)
          return iso >= request.dateFrom && iso <= request.dateTo
        })
        if (rows.length === 0) continue
        anyRows = true
        renderedRecordCount += 1
        await addRendered(inventoryRenderer.render({
          entry,
          data,
          drugSlug: entry.log_key,
          filteredRows: rows.map((r) => ({ ...r })) as Array<Record<string, unknown>>,
          carryForwardStock: computeCarryForwardStock(data, request.dateFrom),
          dateFrom: request.dateFrom,
          dateTo: request.dateTo,
        }, renderCtx))
      }
      if (!anyRows) throw new ApiError("VALIDATION_ERROR", "No saved inventory rows found for that date range")
      break
    }
    default:
      throw new ApiError("VALIDATION_ERROR", "Unsupported log type")
  }

  if (renderedParts.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "No saved logs found for that range")
  }

  const merged = await mergePdfBytes(renderedParts)
  return {
    ...merged,
    fileName: buildFileName(request),
    recordCount: renderedRecordCount,
    warnings: renderCtx.signatureResolver.warnings,
    label: templateLabelForLogType(request.logType),
  }
}
