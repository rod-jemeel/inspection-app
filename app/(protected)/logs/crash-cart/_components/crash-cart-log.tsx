"use client"

import { useState, useCallback, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Save, CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CrashCartTable } from "./crash-cart-table"
import { CrashCartTop } from "./crash-cart-top"
import { emptyCrashCartLogData } from "@/lib/validations/log-entry"
import type { CrashCartLogData } from "@/lib/validations/log-entry"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntryData {
  id: string | null
  data: CrashCartLogData
  status: "draft" | "complete"
  submitted_by_name: string | null
}

interface CrashCartLogProps {
  locationId: string
  year: number
  initialEntry: EntryData | null
  isAdmin?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrashCartLog({
  locationId,
  year,
  initialEntry,
  isAdmin = false,
}: CrashCartLogProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [loadingYear, setLoadingYear] = useState(false)

  const [currentYear, setCurrentYear] = useState(year)
  const [data, setData] = useState<CrashCartLogData>(
    initialEntry?.data ?? emptyCrashCartLogData(year)
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
  // Year navigation - client-side fetch, no page reload
  // ---------------------------------------------------------------------------

  const changeYear = useCallback(
    async (newYear: number) => {
      if (newYear === currentYear) return

      if (dirty) {
        const confirmed = window.confirm(
          "You have unsaved changes. Switching years will discard them. Continue?"
        )
        if (!confirmed) return
      }

      setLoadingYear(true)
      try {
        const params = new URLSearchParams({
          log_type: "crash_cart_checklist",
          log_key: String(newYear),
        })
        const res = await fetch(
          `/api/locations/${locationId}/logs?${params.toString()}`
        )
        if (res.ok) {
          const json = await res.json()
          const entry = json.data?.[0] ?? null
          setData(entry?.data ?? emptyCrashCartLogData(newYear))
          setStatus(entry?.status ?? "draft")
        } else {
          setData(emptyCrashCartLogData(newYear))
          setStatus("draft")
        }
        setCurrentYear(newYear)
        setDirty(false)
        // Update URL without page navigation
        window.history.replaceState(
          null,
          "",
          `/logs/crash-cart?loc=${locationId}&year=${newYear}`
        )
      } finally {
        setLoadingYear(false)
      }
    },
    [currentYear, dirty, locationId]
  )

  // ---------------------------------------------------------------------------
  // Data change
  // ---------------------------------------------------------------------------

  const handleDataChange = useCallback((newData: CrashCartLogData) => {
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
          log_type: "crash_cart_checklist",
          log_key: String(currentYear),
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
    <div className="max-w-full space-y-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Crash Cart Monthly Checklist</h3>
          <Badge
            variant={status === "complete" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {status}
          </Badge>
          {dirty && !isDisabled && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}
          {loadingYear && (
            <span className="text-xs text-muted-foreground">Loading...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => document.getElementById("crash-cart-checklist")?.scrollIntoView({ behavior: "smooth" })}
          >
            Checklist
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => document.getElementById("crash-cart-top")?.scrollIntoView({ behavior: "smooth" })}
          >
            Top of Cart
          </Button>
        </div>
      </div>

      {/* Checklist + Top of Cart - both visible */}
      <div className="space-y-6">
        <div id="crash-cart-checklist">
          <CrashCartTable
            data={data}
            onChange={handleDataChange}
            disabled={isDisabled}
            onYearChange={changeYear}
            isDraft={status === "draft"}
          />
        </div>
        <div id="crash-cart-top">
          <CrashCartTop
            data={data}
            onChange={handleDataChange}
            locationId={locationId}
            disabled={isDisabled}
            isDraft={status === "draft"}
          />
        </div>
      </div>

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
