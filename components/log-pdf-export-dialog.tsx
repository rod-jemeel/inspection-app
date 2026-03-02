"use client"

import { useEffect, useState } from "react"
import { FileDown } from "lucide-react"
import type { ExportableLogType } from "@/lib/validations/log-export"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type RangeKind = "date" | "month" | "year"

interface LogPdfExportDialogProps {
  locationId: string
  logType: ExportableLogType
  rangeKind: RangeKind
  defaultRange?: {
    dateFrom?: string
    dateTo?: string
    monthFrom?: string
    monthTo?: string
    yearFrom?: number
    yearTo?: number
  }
  defaultDrugSlug?: string
  availableDateRange?: {
    from?: string | null
    to?: string | null
  }
  availableDateValues?: string[]
  availableMonthRange?: {
    from?: string | null
    to?: string | null
  }
  availableMonthValues?: string[]
  availableYearRange?: {
    from?: number | null
    to?: number | null
  }
  availableYearValues?: number[]
  hasUnsavedChanges?: boolean
  disabled?: boolean
  stopPropagationOnTrigger?: boolean
  triggerLabel?: string
  className?: string
  onExported?: () => void
  onError?: (message: string) => void
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function last30IsoDate() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function currentMonthIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function parseMonthKey(value: string): { y: number; m: number } | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null
  const [y, m] = value.split("-").map(Number)
  if (m < 1 || m > 12) return null
  return { y, m }
}

function formatDateLabel(value: string): string {
  const dt = parseIsoDate(value)
  if (!dt) return value
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatMonthLabel(value: string): string {
  const p = parseMonthKey(value)
  if (!p) return value
  return new Date(p.y, p.m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function isNextDate(prev: string, next: string) {
  const a = parseIsoDate(prev)
  const b = parseIsoDate(next)
  if (!a || !b) return false
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / dayMs) === 1
}

function isNextMonth(prev: string, next: string) {
  const a = parseMonthKey(prev)
  const b = parseMonthKey(next)
  if (!a || !b) return false
  return a.y * 12 + a.m + 1 === b.y * 12 + b.m
}

function isNextYear(prev: number, next: number) {
  return next === prev + 1
}

function toSegments<T>(values: T[], isNext: (prev: T, next: T) => boolean) {
  if (values.length === 0) return [] as Array<{ start: T; end: T }>
  const segments: Array<{ start: T; end: T }> = []
  let start = values[0]
  let end = values[0]
  for (let i = 1; i < values.length; i++) {
    const v = values[i]
    if (isNext(end, v)) {
      end = v
      continue
    }
    segments.push({ start, end })
    start = v
    end = v
  }
  segments.push({ start, end })
  return segments
}

function dedupeSortedStrings(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort()
}

function dedupeSortedNumbers(values: number[] | undefined) {
  return Array.from(new Set((values ?? []).filter((v) => Number.isFinite(v)))).sort((a, b) => a - b)
}

function summarizeDateSegments(values?: string[], fallback?: { from?: string | null; to?: string | null }) {
  const sorted = dedupeSortedStrings(values)
  if (sorted.length > 0) {
    const segments = toSegments(sorted, isNextDate)
    return {
      segments,
      summary: segments
        .map((s) => (s.start === s.end ? formatDateLabel(s.start) : `${formatDateLabel(s.start)} - ${formatDateLabel(s.end)}`))
        .join(", "),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    }
  }
  if (fallback?.from || fallback?.to) {
    const from = fallback.from ?? "?"
    const to = fallback.to ?? "?"
    return {
      segments: [] as Array<{ start: string; end: string }>,
      summary: `${from} - ${to}`,
      min: fallback.from ?? undefined,
      max: fallback.to ?? undefined,
    }
  }
  return null
}

function summarizeMonthSegments(values?: string[], fallback?: { from?: string | null; to?: string | null }) {
  const sorted = dedupeSortedStrings(values)
  if (sorted.length > 0) {
    const segments = toSegments(sorted, isNextMonth)
    return {
      segments,
      summary: segments
        .map((s) => (s.start === s.end ? formatMonthLabel(s.start) : `${formatMonthLabel(s.start)} - ${formatMonthLabel(s.end)}`))
        .join(", "),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    }
  }
  if (fallback?.from || fallback?.to) {
    const from = fallback.from ?? "?"
    const to = fallback.to ?? "?"
    return {
      segments: [] as Array<{ start: string; end: string }>,
      summary: `${from} - ${to}`,
      min: fallback.from ?? undefined,
      max: fallback.to ?? undefined,
    }
  }
  return null
}

function summarizeYearSegments(values?: number[], fallback?: { from?: number | null; to?: number | null }) {
  const sorted = dedupeSortedNumbers(values)
  if (sorted.length > 0) {
    const segments = toSegments(sorted, isNextYear)
    return {
      segments,
      summary: segments
        .map((s) => (s.start === s.end ? String(s.start) : `${s.start} - ${s.end}`))
        .join(", "),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    }
  }
  if (fallback?.from != null || fallback?.to != null) {
    const from = fallback?.from ?? "?"
    const to = fallback?.to ?? "?"
    return {
      segments: [] as Array<{ start: number; end: number }>,
      summary: `${from} - ${to}`,
      min: fallback.from ?? undefined,
      max: fallback.to ?? undefined,
    }
  }
  return null
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const json = await res.json() as { error?: { message?: string } }
    return json.error?.message ?? `Export failed (${res.status})`
  } catch {
    return `Export failed (${res.status})`
  }
}

function AvailabilityBanner({
  label,
  summary,
  tone = "emerald",
}: {
  label: string
  summary: string
  tone?: "emerald" | "sky"
}) {
  const classes =
    tone === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800"

  return (
    <div className={cn("rounded border px-2 py-1 text-[11px]", classes)}>
      {label}: <span className="font-medium">{summary}</span>
    </div>
  )
}

function DateRangeFields({
  rangeInputClass,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
}: {
  rangeInputClass: string
  dateFrom: string
  dateTo: string
  setDateFrom: (value: string) => void
  setDateTo: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input type="date" className={rangeInputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="date" className={rangeInputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>
    </div>
  )
}

function MonthRangeFields({
  rangeInputClass,
  monthFrom,
  monthTo,
  setMonthFrom,
  setMonthTo,
}: {
  rangeInputClass: string
  monthFrom: string
  monthTo: string
  setMonthFrom: (value: string) => void
  setMonthTo: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input type="month" className={rangeInputClass} value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="month" className={rangeInputClass} value={monthTo} onChange={(e) => setMonthTo(e.target.value)} />
      </div>
    </div>
  )
}

function YearRangeFields({
  rangeInputClass,
  yearFrom,
  yearTo,
  setYearFrom,
  setYearTo,
}: {
  rangeInputClass: string
  yearFrom: string
  yearTo: string
  setYearFrom: (value: string) => void
  setYearTo: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input type="number" className={rangeInputClass} value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="number" className={rangeInputClass} value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
      </div>
    </div>
  )
}

function DailyRowDateFilter({
  rangeInputClass,
  dailyRowDateFrom,
  dailyRowDateTo,
  setDailyRowDateFrom,
  setDailyRowDateTo,
  availableSummary,
  onUseAvailableRange,
  onClear,
}: {
  rangeInputClass: string
  dailyRowDateFrom: string
  dailyRowDateTo: string
  setDailyRowDateFrom: (value: string) => void
  setDailyRowDateTo: (value: string) => void
  availableSummary?: string
  onUseAvailableRange: () => void
  onClear: () => void
}) {
  return (
    <div className="space-y-2 rounded border border-muted p-2">
      <div className="space-y-0.5">
        <p className="text-xs font-medium">Daily row date filter (optional)</p>
        <p className="text-[11px] text-muted-foreground">
          Filters daily columns/rows by actual date within the selected month sheets.
        </p>
      </div>
      <DateRangeFields
        rangeInputClass={rangeInputClass}
        dateFrom={dailyRowDateFrom}
        dateTo={dailyRowDateTo}
        setDateFrom={setDailyRowDateFrom}
        setDateTo={setDailyRowDateTo}
      />
      {availableSummary && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={onUseAvailableRange}
          >
            Use Available Range
          </Button>
          {(dailyRowDateFrom || dailyRowDateTo) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={onClear}
            >
              Clear date filter
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function LogPdfExportDialog({
  locationId,
  logType,
  rangeKind,
  defaultRange,
  defaultDrugSlug,
  availableDateRange,
  availableDateValues,
  availableMonthRange,
  availableMonthValues,
  availableYearRange,
  availableYearValues,
  hasUnsavedChanges,
  disabled,
  stopPropagationOnTrigger = false,
  triggerLabel = "Export PDF",
  className,
  onExported,
  onError,
}: LogPdfExportDialogProps) {
  const inventoryExportsAlwaysIncludeDrafts = logType === "controlled_substance_inventory"
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [includeDrafts, setIncludeDrafts] = useState(inventoryExportsAlwaysIncludeDrafts)

  const [dateFrom, setDateFrom] = useState(defaultRange?.dateFrom ?? last30IsoDate())
  const [dateTo, setDateTo] = useState(defaultRange?.dateTo ?? todayIsoDate())
  const [monthFrom, setMonthFrom] = useState(defaultRange?.monthFrom ?? currentMonthIso())
  const [monthTo, setMonthTo] = useState(defaultRange?.monthTo ?? currentMonthIso())
  const [yearFrom, setYearFrom] = useState(String(defaultRange?.yearFrom ?? new Date().getFullYear()))
  const [yearTo, setYearTo] = useState(String(defaultRange?.yearTo ?? new Date().getFullYear()))
  const [dailyRowDateFrom, setDailyRowDateFrom] = useState("")
  const [dailyRowDateTo, setDailyRowDateTo] = useState("")
  const showDailyNarcoticCountDateFilter = logType === "daily_narcotic_count" && rangeKind === "month"

  useEffect(() => {
    if (!open) return
    if (defaultRange?.dateFrom) setDateFrom(defaultRange.dateFrom)
    if (defaultRange?.dateTo) setDateTo(defaultRange.dateTo)
    if (defaultRange?.monthFrom) setMonthFrom(defaultRange.monthFrom)
    if (defaultRange?.monthTo) setMonthTo(defaultRange.monthTo)
    if (defaultRange?.yearFrom) setYearFrom(String(defaultRange.yearFrom))
    if (defaultRange?.yearTo) setYearTo(String(defaultRange.yearTo))
    if (!showDailyNarcoticCountDateFilter) {
      setDailyRowDateFrom("")
      setDailyRowDateTo("")
    }
  }, [open, defaultRange, showDailyNarcoticCountDateFilter])

  async function handleExport() {
    setSubmitting(true)
    try {
      let body: Record<string, unknown> = {
        logType,
        includeDrafts: inventoryExportsAlwaysIncludeDrafts ? true : includeDrafts,
        sort: "asc",
      }

      if (rangeKind === "date") {
        body = { ...body, dateFrom, dateTo }
      } else if (rangeKind === "month") {
        body = { ...body, monthFrom, monthTo }
        if (showDailyNarcoticCountDateFilter) {
          if ((dailyRowDateFrom && !dailyRowDateTo) || (!dailyRowDateFrom && dailyRowDateTo)) {
            alert("Please set both From and To dates for the daily date filter.")
            return
          }
          if (dailyRowDateFrom && dailyRowDateTo) {
            body = { ...body, dateFrom: dailyRowDateFrom, dateTo: dailyRowDateTo }
          }
        }
      } else {
        const yFrom = Number.parseInt(yearFrom, 10)
        const yTo = Number.parseInt(yearTo, 10)
        body = { ...body, yearFrom: yFrom, yearTo: yTo }
      }

      if (logType === "controlled_substance_inventory") {
        body = {
          ...body,
          rowRangeMode: "rows_only",
          ...(defaultDrugSlug ? { drugSlugs: [defaultDrugSlug] } : {}),
        }
      }

      const res = await fetch(`/api/locations/${locationId}/logs/export-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const msg = await readErrorMessage(res)
        onError?.(msg)
        alert(msg)
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = /filename="([^"]+)"/.exec(disposition)
      const filename = match?.[1] ?? `${logType}-export.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setOpen(false)
      onExported?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Export failed"
      onError?.(msg)
      alert(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const rangeLabel =
    rangeKind === "date" ? "Date range" :
    rangeKind === "month" ? "Month range" :
    "Year range"

  const rangeInputClass = "h-8 text-xs tabular-nums"
  const hasAvailableDateRange = Boolean(availableDateRange?.from || availableDateRange?.to)
  const hasAvailableMonthRange = Boolean(availableMonthRange?.from || availableMonthRange?.to)
  const hasAvailableYearRange =
    availableYearRange?.from != null || availableYearRange?.to != null
  const dateAvailability = summarizeDateSegments(availableDateValues, availableDateRange)
  const monthAvailability = summarizeMonthSegments(availableMonthValues, availableMonthRange)
  const yearAvailability = summarizeYearSegments(availableYearValues, availableYearRange)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("h-7 text-[11px] gap-1.5", className)}
          disabled={disabled}
          onClick={(e) => {
            if (stopPropagationOnTrigger) e.stopPropagation()
          }}
          onMouseDown={(e) => {
            if (stopPropagationOnTrigger) e.stopPropagation()
          }}
        >
          <FileDown className="size-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Export PDF</DialogTitle>
          <DialogDescription className="text-xs">
            Export saved log data as a merged PDF using the paper form template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rangeKind === "date" && (dateAvailability || hasAvailableDateRange) && (
            <AvailabilityBanner
              label="Available saved dates"
              summary={dateAvailability?.summary ?? `${availableDateRange?.from ?? "?"} - ${availableDateRange?.to ?? "?"}`}
            />
          )}
          {rangeKind === "month" && (monthAvailability || hasAvailableMonthRange) && (
            <AvailabilityBanner
              label="Available saved months"
              summary={monthAvailability?.summary ?? `${availableMonthRange?.from ?? "?"} - ${availableMonthRange?.to ?? "?"}`}
            />
          )}
          {showDailyNarcoticCountDateFilter && dateAvailability && (
            <AvailabilityBanner
              label="Available saved daily dates"
              summary={dateAvailability.summary}
              tone="sky"
            />
          )}
          {rangeKind === "year" && (yearAvailability || hasAvailableYearRange) && (
            <AvailabilityBanner
              label="Available saved years"
              summary={yearAvailability?.summary ?? `${availableYearRange?.from ?? "?"} - ${availableYearRange?.to ?? "?"}`}
            />
          )}

          <div className="space-y-1">
            <p className="text-xs font-medium">{rangeLabel}</p>
            {rangeKind === "date" && (
              <DateRangeFields
                rangeInputClass={rangeInputClass}
                dateFrom={dateFrom}
                dateTo={dateTo}
                setDateFrom={setDateFrom}
                setDateTo={setDateTo}
              />
            )}
            {rangeKind === "month" && (
              <MonthRangeFields
                rangeInputClass={rangeInputClass}
                monthFrom={monthFrom}
                monthTo={monthTo}
                setMonthFrom={setMonthFrom}
                setMonthTo={setMonthTo}
              />
            )}
            {showDailyNarcoticCountDateFilter && (
              <DailyRowDateFilter
                rangeInputClass={rangeInputClass}
                dailyRowDateFrom={dailyRowDateFrom}
                dailyRowDateTo={dailyRowDateTo}
                setDailyRowDateFrom={setDailyRowDateFrom}
                setDailyRowDateTo={setDailyRowDateTo}
                availableSummary={dateAvailability?.summary}
                onUseAvailableRange={() => {
                  setDailyRowDateFrom(dateAvailability?.min ?? "")
                  setDailyRowDateTo(dateAvailability?.max ?? "")
                }}
                onClear={() => {
                  setDailyRowDateFrom("")
                  setDailyRowDateTo("")
                }}
              />
            )}
            {rangeKind === "year" && (
              <YearRangeFields
                rangeInputClass={rangeInputClass}
                yearFrom={yearFrom}
                yearTo={yearTo}
                setYearFrom={setYearFrom}
                setYearTo={setYearTo}
              />
            )}
            {rangeKind === "date" && (dateAvailability || hasAvailableDateRange) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  setDateFrom(dateAvailability?.min ?? availableDateRange?.from ?? dateFrom)
                  setDateTo(dateAvailability?.max ?? availableDateRange?.to ?? dateTo)
                }}
              >
                Use Available Range
              </Button>
            )}
            {rangeKind === "month" && (monthAvailability || hasAvailableMonthRange) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  setMonthFrom(monthAvailability?.min ?? availableMonthRange?.from ?? monthFrom)
                  setMonthTo(monthAvailability?.max ?? availableMonthRange?.to ?? monthTo)
                }}
              >
                Use Available Range
              </Button>
            )}
            {rangeKind === "year" && (yearAvailability || hasAvailableYearRange) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  if (yearAvailability?.min != null) setYearFrom(String(yearAvailability.min))
                  else if (availableYearRange?.from != null) setYearFrom(String(availableYearRange.from))
                  if (yearAvailability?.max != null) setYearTo(String(yearAvailability.max))
                  else if (availableYearRange?.to != null) setYearTo(String(availableYearRange.to))
                }}
              >
                Use Available Range
              </Button>
            )}
          </div>

          {logType === "controlled_substance_inventory" && (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">
                {defaultDrugSlug
                  ? `Exporting only the ${defaultDrugSlug} ledger rows in range.`
                  : "Exporting all inventory ledgers with rows in the selected range."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Inventory ledgers are ongoing and usually saved as drafts, so drafts are included automatically.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2">
            <Checkbox
              id={`export-drafts-${logType}`}
              checked={inventoryExportsAlwaysIncludeDrafts ? true : includeDrafts}
              disabled={inventoryExportsAlwaysIncludeDrafts}
              onCheckedChange={(v) => setIncludeDrafts(v === true)}
            />
            <Label htmlFor={`export-drafts-${logType}`} className="text-xs leading-4">
              {inventoryExportsAlwaysIncludeDrafts ? "Include draft records (required for inventory)" : "Include draft records"}
            </Label>
          </div>

          {hasUnsavedChanges && (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              Export uses saved data only. Unsaved changes are not included.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} disabled={submitting}>
            {submitting ? "Exporting..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
