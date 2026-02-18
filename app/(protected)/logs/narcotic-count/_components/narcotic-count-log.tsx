"use client"

import { useState, useCallback, useTransition, useEffect, Fragment } from "react"
import { useRouter } from "next/navigation"
import { Save, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight, Table2, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NarcoticCountTable } from "./narcotic-count-table"
import { SignatureIdentification } from "@/components/signature-identification"
import { emptyDailyNarcoticCountLogData, NARCOTIC_COUNT_DRUGS } from "@/lib/validations/log-entry"
import { cn } from "@/lib/utils"
import type { DailyNarcoticCountLogData } from "@/lib/validations/log-entry"

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
}

// ---------------------------------------------------------------------------
// Summary View (compact read-only table showing ALL entries)
// ---------------------------------------------------------------------------

const S_HDR = `${B} bg-muted/30 px-1 py-1 text-[10px] font-semibold text-center whitespace-nowrap`
const S_CELL = `${B} px-1 py-0.5 text-[10px] text-center tabular-nums`

function NarcoticCountSummary({ data }: { data: DailyNarcoticCountLogData }) {
  const drugKeys = NARCOTIC_COUNT_DRUGS.map((d) => d.key) as Array<
    "fentanyl" | "midazolam" | "ephedrine"
  >

  // Filter to only entries that have a date filled in
  const filledEntries = data.entries.filter((e) => e.date.trim() !== "")

  if (filledEntries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No entries with dates to display. Switch to Form view to add data.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto max-w-full">
      <table className="border-collapse text-[10px] w-full">
        <thead>
          {/* Row 1: Date + Drug group headers + Initials */}
          <tr>
            <th rowSpan={2} className={cn(S_HDR, "min-w-[52px]")}>Date</th>
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
          {filledEntries.map((entry, i) => (
            <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/10"}>
              <td className={cn(S_CELL, "font-medium")}>{entry.date}</td>
              {drugKeys.map((dk) => (
                <Fragment key={dk}>
                  <td className={S_CELL}>{entry[dk].am || "-"}</td>
                  <td className={S_CELL}>{entry[dk].rcvd || "-"}</td>
                  <td className={S_CELL}>{entry[dk].pm || "-"}</td>
                </Fragment>
              ))}
              <td className={cn(S_CELL, "font-medium")}>{entry.initials_am || "-"}</td>
              <td className={cn(S_CELL, "font-medium")}>{entry.initials_am_2 || "-"}</td>
              <td className={cn(S_CELL, "font-medium")}>{entry.initials_pm || "-"}</td>
              <td className={cn(S_CELL, "font-medium")}>{entry.initials_pm_2 || "-"}</td>
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
}: NarcoticCountLogProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"form" | "summary">("form")

  const [currentYear, setCurrentYear] = useState(year)
  const [currentMonth, setCurrentMonth] = useState(month)

  const [data, setData] = useState<DailyNarcoticCountLogData>(() => {
    if (initialEntry?.data) return initialEntry.data
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

  const navigateMonth = useCallback(
    async (offset: number) => {
      let newMonth = currentMonth + offset
      let newYear = currentYear
      if (newMonth < 1) {
        newMonth = 12
        newYear -= 1
      } else if (newMonth > 12) {
        newMonth = 1
        newYear += 1
      }

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
            setData(entry.data)
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

  // ---------------------------------------------------------------------------
  // Data change
  // ---------------------------------------------------------------------------

  const handleDataChange = useCallback((newData: DailyNarcoticCountLogData) => {
    setData(newData)
    setDirty(true)
  }, [])

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

      startTransition(() => {
        router.refresh()
      })
    } finally {
      setSaving(false)
    }
  }

  const isDisabled = status === "complete"

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
          <h3 className="text-sm font-semibold tabular-nums whitespace-nowrap">
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </h3>
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

      {/* Count table or Summary view */}
      {viewMode === "form" ? (
        <>
          <NarcoticCountTable
            data={data}
            onChange={handleDataChange}
            disabled={isDisabled}
            isDraft={status === "draft"}
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
        <NarcoticCountSummary data={data} />
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
