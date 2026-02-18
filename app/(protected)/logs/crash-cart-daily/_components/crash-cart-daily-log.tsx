"use client"

import { useState, useCallback, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Save, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
    <div className="space-y-4 overflow-hidden max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Crash Cart Daily Checklist</h3>
          {/* Year navigation */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => navigateYear(-1)}
            disabled={loading}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h3 className="text-sm font-semibold tabular-nums">{currentYear}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => navigateYear(1)}
            disabled={loading}
          >
            <ChevronRight className="size-4" />
          </Button>

          {/* Month dropdown */}
          <Select
            value={String(currentMonth)}
            onValueChange={handleMonthChange}
            disabled={loading}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs">
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
      </div>

      {/* Table */}
      <CrashCartDailyTable
        data={data}
        onChange={handleDataChange}
        locationId={locationId}
        disabled={isDisabled}
        isDraft={status === "draft"}
      />

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
            This checklist has been submitted as complete. Contact an admin to
            revert.
          </p>
        )}
      </div>
    </div>
  )
}
