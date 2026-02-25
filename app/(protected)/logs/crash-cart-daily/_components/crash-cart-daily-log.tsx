"use client"

import { useState, useCallback, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogPdfExportDialog } from "@/components/log-pdf-export-dialog"
import { LogActionBar } from "../../_components/log-action-bar"
import { LogFormLayout } from "../../_components/log-form-layout"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CrashCartDailyTable } from "./crash-cart-daily-table"
import { emptyCrashCartDailyLogData } from "@/lib/validations/log-entry"
import type { CrashCartDailyLogData } from "@/lib/validations/log-entry"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntryData {
  id: string | null
  data: CrashCartDailyLogData
  status: "draft" | "complete"
  submitted_by_name: string | null
}

interface CrashCartDailyLogProps {
  locationId: string
  year: number
  month: number // 1-12
  initialEntry: EntryData | null
  isAdmin?: boolean
  availableMonthRange?: {
    from?: string | null
    to?: string | null
  }
  availableMonthValues?: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrashCartDailyLog({
  locationId,
  year,
  month,
  initialEntry,
  isAdmin = false,
  availableMonthRange,
  availableMonthValues,
}: CrashCartDailyLogProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const [currentYear, setCurrentYear] = useState(year)
  const [currentMonth, setCurrentMonth] = useState(month)

  const monthLabel = MONTH_NAMES[currentMonth - 1]

  const [data, setData] = useState<CrashCartDailyLogData>(
    initialEntry?.data ?? emptyCrashCartDailyLogData(year, monthLabel)
  )
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
  // Navigation - client-side fetch, no page reload
  // ---------------------------------------------------------------------------

  const navigate = useCallback(
    async (newYear: number, newMonth: number) => {
      if (newYear === currentYear && newMonth === currentMonth) return

      if (dirty) {
        const confirmed = window.confirm(
          "You have unsaved changes. Switching will discard them. Continue?"
        )
        if (!confirmed) return
      }

      setLoading(true)
      try {
        const monthNum = String(newMonth).padStart(2, "0")
        const params = new URLSearchParams({
          log_type: "crash_cart_daily",
          log_key: `${newYear}-${monthNum}`,
        })
        const res = await fetch(
          `/api/locations/${locationId}/logs?${params.toString()}`
        )
        const newMonthLabel = MONTH_NAMES[newMonth - 1]
        if (res.ok) {
          const json = await res.json()
          const entry = json.entries?.[0] ?? null
          setData(entry?.data ?? emptyCrashCartDailyLogData(newYear, newMonthLabel))
          setStatus(entry?.status ?? "draft")
        } else {
          setData(emptyCrashCartDailyLogData(newYear, newMonthLabel))
          setStatus("draft")
        }
        setCurrentYear(newYear)
        setCurrentMonth(newMonth)
        setDirty(false)
        window.history.replaceState(
          null,
          "",
          `/logs/crash-cart-daily?loc=${locationId}&year=${newYear}&month=${newMonth}`
        )
      } finally {
        setLoading(false)
      }
    },
    [currentYear, currentMonth, dirty, locationId]
  )

  const navigateYear = useCallback(
    (offset: number) => navigate(currentYear + offset, currentMonth),
    [currentYear, currentMonth, navigate]
  )

  const handleMonthChange = useCallback(
    (value: string) => navigate(currentYear, parseInt(value, 10)),
    [currentYear, navigate]
  )

  // ---------------------------------------------------------------------------
  // Data change
  // ---------------------------------------------------------------------------

  const handleDataChange = useCallback((newData: CrashCartDailyLogData) => {
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
          log_type: "crash_cart_daily",
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
    <LogFormLayout
      title="Crash Cart Daily Checklist"
      status={status}
      dirty={dirty}
      loading={loading}
      secondaryToolbar={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => navigateYear(-1)}
                disabled={loading}
                aria-label="Previous year"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[52px] text-center text-sm font-semibold tabular-nums">
                {currentYear}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => navigateYear(1)}
                disabled={loading}
                aria-label="Next year"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <Select
              value={String(currentMonth)}
              onValueChange={handleMonthChange}
              disabled={loading}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <LogPdfExportDialog
            locationId={locationId}
            logType="crash_cart_daily"
            rangeKind="month"
            defaultRange={{
              monthFrom: monthKey(currentYear, currentMonth),
              monthTo: monthKey(currentYear, currentMonth),
            }}
            availableMonthRange={availableMonthRange}
            availableMonthValues={availableMonthValues}
            hasUnsavedChanges={dirty}
          />
        </>
      }
      footerActions={
        <LogActionBar
          status={status}
          dirty={dirty}
          saving={saving}
          isAdmin={isAdmin}
          entityLabel="checklist"
          onSaveDraft={() => save("draft")}
          onSaveComplete={() => save("complete")}
          onRevertToDraft={() => save("draft")}
        />
      }
    >
      <CrashCartDailyTable
        data={data}
        onChange={handleDataChange}
        locationId={locationId}
        disabled={isDisabled}
        isDraft={status === "draft"}
      />
    </LogFormLayout>
  )
}
