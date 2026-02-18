"use client"

import { useState, useCallback, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Save, CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NarcoticSignoutTable } from "./narcotic-signout-table"
import { emptyNarcoticSignoutLogData } from "@/lib/validations/log-entry"
import type { NarcoticSignoutLogData } from "@/lib/validations/log-entry"

interface LogEntryData {
  id: string | null
  log_date: string
  data: NarcoticSignoutLogData
  status: "draft" | "complete"
  submitted_by_name: string | null
}

interface NarcoticSignoutLogProps {
  locationId: string
  initialDate: string
  initialEntry: LogEntryData | null
  isAdmin?: boolean
}

export function NarcoticSignoutLog({
  locationId,
  initialDate,
  initialEntry,
  isAdmin = false,
}: NarcoticSignoutLogProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const [currentDate, setCurrentDate] = useState(initialDate)
  const [data, setData] = useState<NarcoticSignoutLogData>(
    initialEntry?.data ?? emptyNarcoticSignoutLogData()
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
  // Date navigation - client-side fetch, no page reload
  // ---------------------------------------------------------------------------

  const fetchDateEntry = useCallback(
    async (newDate: string) => {
      if (newDate === currentDate) return

      if (dirty) {
        const confirmed = window.confirm(
          "You have unsaved changes. Switching dates will discard them. Continue?"
        )
        if (!confirmed) return
      }

      setLoading(true)
      try {
        const params = new URLSearchParams({
          log_type: "narcotic_signout",
          from: newDate,
          to: newDate,
        })
        const res = await fetch(
          `/api/locations/${locationId}/logs?${params.toString()}`
        )
        if (res.ok) {
          const json = await res.json()
          const entry = json.entries?.[0] ?? null
          setData(entry?.data ?? emptyNarcoticSignoutLogData())
          setStatus(entry?.status ?? "draft")
        } else {
          setData(emptyNarcoticSignoutLogData())
          setStatus("draft")
        }
        setCurrentDate(newDate)
        setDirty(false)
        window.history.replaceState(
          null,
          "",
          `/logs/narcotic-signout?loc=${locationId}&date=${newDate}`
        )
      } finally {
        setLoading(false)
      }
    },
    [currentDate, dirty, locationId]
  )

  const navigateDate = useCallback(
    (offset: number) => {
      const d = new Date(currentDate + "T00:00:00")
      d.setDate(d.getDate() + offset)
      const newDate = d.toISOString().split("T")[0]
      fetchDateEntry(newDate)
    },
    [currentDate, fetchDateEntry]
  )

  const goToDate = useCallback(
    (newDate: string) => {
      fetchDateEntry(newDate)
    },
    [fetchDateEntry]
  )

  // ---------------------------------------------------------------------------
  // Data change
  // ---------------------------------------------------------------------------

  const handleDataChange = useCallback((newData: NarcoticSignoutLogData) => {
    setData(newData)
    setDirty(true)
  }, [])

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function save(newStatus: "draft" | "complete") {
    setSaving(true)
    try {
      const res = await fetch(`/api/locations/${locationId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_type: "narcotic_signout",
          log_date: currentDate,
          log_key: "",
          data,
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
          <h3 className="text-sm font-semibold">Narcotic Sign-out</h3>
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
      <NarcoticSignoutTable
        data={data}
        onChange={handleDataChange}
        locationId={locationId}
        disabled={isDisabled}
        date={currentDate}
        onNavigateDate={navigateDate}
        onGoToDate={goToDate}
        isPending={loading}
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
            This log has been submitted as complete. Contact an admin to revert.
          </p>
        )}
      </div>
    </div>
  )
}
