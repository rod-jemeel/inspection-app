"use client"

import { useState, useCallback, useTransition, useEffect, Fragment } from "react"
import { useRouter } from "next/navigation"
import { Save, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight, Table2, ClipboardList, CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { NarcoticCountTable } from "./narcotic-count-table"
import { SignatureIdentification } from "@/components/signature-identification"
import { LogPdfExportDialog } from "@/components/log-pdf-export-dialog"
import {
  dailyNarcoticCountLogDataSchema,
  emptyDailyNarcoticCountLogData,
  NARCOTIC_COUNT_DRUGS,
} from "@/lib/validations/log-entry"
import { cn } from "@/lib/utils"
import type { DailyNarcoticCountLogData, NarcoticCountEntry } from "@/lib/validations/log-entry"

// ---------------------------------------------------------------------------
// Shared cell style constants (for summary view)
// ---------------------------------------------------------------------------

const B = "border border-foreground/25"

// ---------------------------------------------------------------------------
// Month names for display
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntryData {
  id: string | null
  data: DailyNarcoticCountLogData
  status: "draft" | "complete"
  submitted_by_name: string | null
}

interface NarcoticCountLogProps {
  locationId: string
  year: number
  month: number
  initialEntry: EntryData | null
  isAdmin?: boolean
  availableMonthValues?: string[]
  availableDateValues?: string[]
}

interface SummaryRow {
  sheetKey: string
  sheetLabel: string
  status: "draft" | "complete" | null
  row: NarcoticCountEntry
}

function collectSummaryRows(
  data: DailyNarcoticCountLogData,
  meta?: { sheetKey?: string; sheetLabel?: string; status?: "draft" | "complete" | null }
): SummaryRow[] {
  const sheetLabel =
    meta?.sheetLabel ??
    (data.month_label && data.year ? `${data.month_label} ${data.year}` : "Current")

  const sheetKey = meta?.sheetKey ?? `${data.year}-${String((MONTH_NAMES.indexOf(data.month_label) ?? -1) + 1).padStart(2, "0")}`

  return (data.entries ?? [])
    .filter((e) => e.date.trim() !== "")
    .map((row) => ({
      sheetKey,
      sheetLabel,
      status: meta?.status ?? null,
      row,
    }))
}

// ---------------------------------------------------------------------------
// Summary View (compact read-only table showing ALL entries)
// ---------------------------------------------------------------------------

const S_HDR = `${B} bg-muted/30 px-1 py-1 text-[10px] font-semibold text-center whitespace-nowrap`
const S_CELL = `${B} px-1 py-0.5 text-[10px] text-center tabular-nums`

function NarcoticCountSummary({
  rows,
  emptyMessage,
  showSheetColumn = false,
}: {
  rows: SummaryRow[]
  emptyMessage: string
  showSheetColumn?: boolean
}) {
  const drugKeys = NARCOTIC_COUNT_DRUGS.map((d) => d.key) as Array<
    "fentanyl" | "midazolam" | "ephedrine"
  >

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto max-w-full">
      <table className="border-collapse text-[10px] w-full">
        <thead>
          {/* Row 1: Date + Drug group headers + Initials */}
          <tr>
            {showSheetColumn && (
              <th rowSpan={2} className={cn(S_HDR, "min-w-[112px]")}>Sheet</th>
            )}
            <th rowSpan={2} className={cn(S_HDR, "min-w-[72px]")}>Date</th>
            {NARCOTIC_COUNT_DRUGS.map((drug) => (
              <th key={drug.key} colSpan={3} className={S_HDR}>
                {drug.label.split(",")[0]}
              </th>
            ))}
            <th colSpan={4} className={cn(S_HDR, "min-w-[100px]")}>Initials</th>
          </tr>
          {/* Row 2: AM / Rcvd / PM sub-headers per drug + AM/PM initials (2 each) */}
          <tr>
            {drugKeys.map((dk) => (
              <Fragment key={dk}>
                <th className={cn(S_HDR, "min-w-[28px]")}>AM</th>
                <th className={cn(S_HDR, "min-w-[28px]")}>Rcvd</th>
                <th className={cn(S_HDR, "min-w-[28px]")}>PM</th>
              </Fragment>
            ))}
            <th colSpan={2} className={cn(S_HDR, "min-w-[50px]")}>AM</th>
            <th colSpan={2} className={cn(S_HDR, "min-w-[50px]")}>PM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record, i) => (
            <tr key={`${record.sheetKey}-${record.row.date}-${i}`} className={i % 2 === 0 ? "" : "bg-muted/10"}>
              {showSheetColumn && (
                <td className={cn(S_CELL, "font-medium whitespace-nowrap")}>
                  {record.sheetLabel}
                </td>
              )}
              <td className={cn(S_CELL, "font-medium whitespace-nowrap")}>{record.row.date}</td>
              {drugKeys.map((dk) => (
                <Fragment key={dk}>
                  <td className={S_CELL}>{record.row[dk].am || "-"}</td>
                  <td className={S_CELL}>{record.row[dk].rcvd || "-"}</td>
                  <td className={S_CELL}>{record.row[dk].pm || "-"}</td>
                </Fragment>
              ))}
              <td className={cn(S_CELL, "font-medium")}>{record.row.initials_am || "-"}</td>
              <td className={cn(S_CELL, "font-medium")}>{record.row.initials_am_2 || "-"}</td>
              <td className={cn(S_CELL, "font-medium")}>{record.row.initials_pm || "-"}</td>
              <td className={cn(S_CELL, "font-medium")}>{record.row.initials_pm_2 || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NarcoticCountLog({
  locationId,
  year,
  month,
  initialEntry,
  isAdmin = false,
  availableMonthValues,
  availableDateValues,
}: NarcoticCountLogProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"form" | "summary">("form")
  const [summaryScope, setSummaryScope] = useState<"current" | "all">("current")
  const [allSummaryRows, setAllSummaryRows] = useState<SummaryRow[] | null>(null)
  const [allSummaryLoading, setAllSummaryLoading] = useState(false)
  const [allSummaryError, setAllSummaryError] = useState<string | null>(null)

  const [currentYear, setCurrentYear] = useState(year)
  const [currentMonth, setCurrentMonth] = useState(month)

  const [data, setData] = useState<DailyNarcoticCountLogData>(() => {
    if (initialEntry?.data) return dailyNarcoticCountLogDataSchema.parse(initialEntry.data)
    const empty = emptyDailyNarcoticCountLogData()
    empty.month_label = MONTH_NAMES[month - 1] ?? ""
    empty.year = year
    return empty
  })
  const [status, setStatus] = useState<"draft" | "complete">(
    initialEntry?.status ?? "draft"
  )
  const [dirty, setDirty] = useState(false)

  // ---------------------------------------------------------------------------
  // Navigation guard - warn before discarding unsaved changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!dirty) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [dirty])

  // ---------------------------------------------------------------------------
  // Month navigation - client-side fetch, no page reload
  // ---------------------------------------------------------------------------

  const loadMonth = useCallback(
    async (newYear: number, newMonth: number) => {
      if (newYear === currentYear && newMonth === currentMonth) return

      if (dirty) {
        const confirmed = window.confirm(
          "You have unsaved changes. Switching months will discard them. Continue?"
        )
        if (!confirmed) return
      }

      setLoading(true)
      try {
        const monthNum = String(newMonth).padStart(2, "0")
        const params = new URLSearchParams({
          log_type: "daily_narcotic_count",
          log_key: `${newYear}-${monthNum}`,
        })
        const res = await fetch(
          `/api/locations/${locationId}/logs?${params.toString()}`
        )
        if (res.ok) {
          const json = await res.json()
          const entry = json.entries?.[0] ?? null
          if (entry?.data) {
            setData(dailyNarcoticCountLogDataSchema.parse(entry.data))
          } else {
            const empty = emptyDailyNarcoticCountLogData()
            empty.month_label = MONTH_NAMES[newMonth - 1] ?? ""
            empty.year = newYear
            setData(empty)
          }
          setStatus(entry?.status ?? "draft")
        } else {
          const empty = emptyDailyNarcoticCountLogData()
          empty.month_label = MONTH_NAMES[newMonth - 1] ?? ""
          empty.year = newYear
          setData(empty)
          setStatus("draft")
        }
        setCurrentYear(newYear)
        setCurrentMonth(newMonth)
        setDirty(false)
        window.history.replaceState(
          null,
          "",
          `/logs/narcotic-count?loc=${locationId}&year=${newYear}&month=${newMonth}`
        )
      } finally {
        setLoading(false)
      }
    },
    [currentMonth, currentYear, dirty, locationId]
  )

  const navigateMonth = useCallback(
    async (offset: number) => {
      let nextMonthIndex = currentMonth - 1 + offset
      const newYear = currentYear + Math.floor(nextMonthIndex / 12)
      nextMonthIndex = ((nextMonthIndex % 12) + 12) % 12
      const newMonth = nextMonthIndex + 1
      await loadMonth(newYear, newMonth)
    },
    [currentMonth, currentYear, loadMonth]
  )

  // ---------------------------------------------------------------------------
  // Data change
  // ---------------------------------------------------------------------------

  const handleDataChange = useCallback((newData: DailyNarcoticCountLogData) => {
    setData(newData)
    setDirty(true)
  }, [])

  const loadAllSummary = useCallback(async () => {
    setAllSummaryLoading(true)
    setAllSummaryError(null)
    try {
      const collected: SummaryRow[] = []
      let offset = 0
      let total = 1

      while (offset < total) {
        const params = new URLSearchParams({
          log_type: "daily_narcotic_count",
          limit: "100",
          offset: String(offset),
        })
        const res = await fetch(`/api/locations/${locationId}/logs?${params.toString()}`)
        if (!res.ok) {
          throw new Error("Failed to load summary data")
        }

        const json = await res.json() as {
          entries?: Array<{
            log_key: string
            status?: "draft" | "complete"
            data?: DailyNarcoticCountLogData
          }>
          total?: number
        }

        const entries = json.entries ?? []
        total = json.total ?? entries.length

        for (const entry of entries) {
          const sheetData = entry.data
          if (!sheetData) continue
          const parsedSheetData = dailyNarcoticCountLogDataSchema.parse(sheetData)

          const sheetLabel =
            parsedSheetData.month_label && parsedSheetData.year
              ? `${parsedSheetData.month_label} ${parsedSheetData.year}`
              : entry.log_key

          collected.push(
            ...collectSummaryRows(parsedSheetData, {
              sheetKey: entry.log_key,
              sheetLabel,
              status: entry.status ?? null,
            })
          )
        }

        if (entries.length === 0) break
        offset += entries.length
      }

      collected.sort((a, b) => {
        const aDate = a.row.date
        const bDate = b.row.date
        if (aDate !== bDate) return aDate < bDate ? 1 : -1
        if (a.sheetKey !== b.sheetKey) return a.sheetKey < b.sheetKey ? 1 : -1
        return 0
      })

      setAllSummaryRows(collected)
    } catch (error) {
      setAllSummaryError(error instanceof Error ? error.message : "Failed to load summary data")
    } finally {
      setAllSummaryLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    if (viewMode !== "summary" || summaryScope !== "all" || allSummaryRows !== null || allSummaryLoading) {
      return
    }
    void loadAllSummary()
  }, [viewMode, summaryScope, allSummaryRows, allSummaryLoading, loadAllSummary])

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function save(newStatus: "draft" | "complete") {
    setSaving(true)
    try {
      const monthNum = String(currentMonth).padStart(2, "0")
      const res = await fetch(`/api/locations/${locationId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_type: "daily_narcotic_count",
          log_key: `${currentYear}-${monthNum}`,
          log_date: "1970-01-01",
          data: data,
          status: newStatus,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err?.error?.message ?? "Failed to save")
        return
      }

      setStatus(newStatus)
      setDirty(false)
      setAllSummaryRows(null)
      setAllSummaryError(null)

      startTransition(() => {
        router.refresh()
      })
    } finally {
      setSaving(false)
    }
  }

  const isDisabled = status === "complete"
  const currentSummaryRows = collectSummaryRows(data, {
    sheetKey: `${currentYear}-${String(currentMonth).padStart(2, "0")}`,
    sheetLabel: `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`,
    status,
  })

  return (
    <div className="space-y-6 overflow-hidden max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Narcotic Count Log</h3>
          {/* Month navigation */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => navigateMonth(-1)}
            disabled={loading}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs font-normal tabular-nums whitespace-nowrap"
                disabled={loading}
              >
                <CalendarIcon className="size-3.5" />
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="single"
                captionLayout="dropdown"
                startMonth={new Date(2020, 0, 1)}
                endMonth={new Date(2035, 11, 1)}
                defaultMonth={new Date(currentYear, currentMonth - 1, 1)}
                selected={new Date(currentYear, currentMonth - 1, 1)}
                onSelect={(date) => {
                  if (!date) return
                  void loadMonth(date.getFullYear(), date.getMonth() + 1)
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => navigateMonth(1)}
            disabled={loading}
          >
            <ChevronRight className="size-4" />
          </Button>

          <Badge
            variant={status === "complete" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {status}
          </Badge>
          {dirty && !isDisabled && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}
          {loading && (
            <span className="text-xs text-muted-foreground">Loading...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <LogPdfExportDialog
            locationId={locationId}
            logType="daily_narcotic_count"
            rangeKind="month"
            defaultRange={{
              monthFrom: monthKey(currentYear, currentMonth),
              monthTo: monthKey(currentYear, currentMonth),
            }}
            availableMonthValues={availableMonthValues}
            availableDateValues={availableDateValues}
            hasUnsavedChanges={dirty}
          />
          {/* View mode toggle */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5"
            onClick={() => setViewMode((v) => (v === "form" ? "summary" : "form"))}
          >
            {viewMode === "form" ? (
              <Table2 className="size-3.5" />
            ) : (
              <ClipboardList className="size-3.5" />
            )}
            {viewMode === "form" ? "Summary" : "Form"}
          </Button>
        </div>
      </div>

      {/* Count table or Summary view */}
      {viewMode === "form" ? (
        <>
          <NarcoticCountTable
            data={data}
            onChange={handleDataChange}
            disabled={isDisabled}
            isDraft={status === "draft"}
            sheetYear={currentYear}
            sheetMonth={currentMonth}
          />

          {/* Signature Identification — only shown in form view */}
          <SignatureIdentification
            signatures={data.signatures}
            onChange={(sigs) => handleDataChange({ ...data, signatures: sigs })}
            locationId={locationId}
            disabled={isDisabled}
            maxRows={8}
            columns={2}
          />
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center rounded-md border border-border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={summaryScope === "current" ? "secondary" : "ghost"}
                className="h-7 text-[11px]"
                onClick={() => setSummaryScope("current")}
              >
                Current Month
              </Button>
              <Button
                type="button"
                size="sm"
                variant={summaryScope === "all" ? "secondary" : "ghost"}
                className="h-7 text-[11px]"
                onClick={() => {
                  setSummaryScope("all")
                  if (allSummaryRows === null && !allSummaryLoading) {
                    void loadAllSummary()
                  }
                }}
              >
                All Saved Data
              </Button>
            </div>

            {summaryScope === "all" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => void loadAllSummary()}
                disabled={allSummaryLoading}
              >
                {allSummaryLoading ? "Loading..." : "Refresh Summary"}
              </Button>
            )}
          </div>

          {summaryScope === "all" && dirty && (
            <p className="text-xs text-amber-600">
              Unsaved changes in the current month are not included in &quot;All Saved Data&quot;.
            </p>
          )}

          {summaryScope === "all" && allSummaryError ? (
            <p className="text-xs text-destructive">{allSummaryError}</p>
          ) : summaryScope === "all" && allSummaryLoading && allSummaryRows === null ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Loading saved narcotic count logs...
            </p>
          ) : (
            <NarcoticCountSummary
              rows={summaryScope === "all" ? (allSummaryRows ?? []) : currentSummaryRows}
              showSheetColumn={summaryScope === "all"}
              emptyMessage={
                summaryScope === "all"
                  ? "No saved narcotic count entries found yet."
                  : "No entries with dates to display. Switch to Form view to add data."
              }
            />
          )}
        </div>
      )}

      {/* Save actions */}
      <div className="sticky bottom-0 z-20 border-t border-border/50 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex flex-wrap items-center gap-2">
        {!isDisabled && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => save("draft")}
              disabled={saving || !dirty}
            >
              <Save className="mr-1 size-3" />
              {saving ? "Saving\u2026" : "Save Draft"}
            </Button>
            <Button
              size="sm"
              onClick={() => save("complete")}
              disabled={saving}
            >
              <CheckCircle2 className="mr-1 size-3" />
              {saving ? "Saving\u2026" : "Submit as Complete"}
            </Button>
          </>
        )}
        {isDisabled && isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => save("draft")}
            disabled={saving}
          >
            <RotateCcw className="mr-1 size-3" />
            {saving ? "Reverting\u2026" : "Revert to Draft"}
          </Button>
        )}
        {isDisabled && !isAdmin && (
          <p className="text-xs text-muted-foreground">
            This log has been submitted as complete. Contact an admin to revert.
          </p>
        )}
      </div>
    </div>
  )
}
