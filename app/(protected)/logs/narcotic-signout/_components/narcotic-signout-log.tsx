"use client"

import { useState, useCallback, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LogPdfExportDialog } from "@/components/log-pdf-export-dialog"
import { LogActionBar } from "../../_components/log-action-bar"
import { LogFormLayout } from "../../_components/log-form-layout"
import { LogPeriodNavigator } from "../../_components/log-period-navigator"
import { RecentLogChangesPanel } from "../../_components/recent-log-changes-panel"
import { NarcoticSignoutTable } from "./narcotic-signout-table"
import { emptyNarcoticSignoutLogData } from "@/lib/validations/log-entry"
import type { NarcoticSignoutLogData } from "@/lib/validations/log-entry"
import { useStartInstance } from "@/hooks/use-start-instance"

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
  availableDateValues?: string[]
  instanceId?: string | null
}

export function NarcoticSignoutLog({
  locationId,
  initialDate,
  initialEntry,
  isAdmin = false,
  availableDateValues,
  instanceId = null,
}: NarcoticSignoutLogProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  useStartInstance(locationId, instanceId)
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
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)

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

  const goToToday = useCallback(() => {
    fetchDateEntry(new Date().toISOString().split("T")[0])
  }, [fetchDateEntry])

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
          ...(instanceId ? { inspection_instance_id: instanceId } : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err?.error?.message ?? "Failed to save")
        return
      }

      setStatus(newStatus)
      setDirty(false)
      setAuditRefreshKey((k) => k + 1)

      startTransition(() => {
        router.refresh()
      })
    } finally {
      setSaving(false)
    }
  }

  const isDisabled = status === "complete"

  return (
    <>
    {instanceId && (
      <Link
        href={`/inspections/${instanceId}?loc=${locationId}`}
        className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Inspection
      </Link>
    )}
    <LogFormLayout
      title="Narcotic Sign-out"
      status={status}
      dirty={dirty}
      loading={loading}
      topToolbar={
        <LogPeriodNavigator
          kind="date"
          value={currentDate}
          onNavigate={navigateDate}
          onChange={goToDate}
          onToday={goToToday}
          disabled={loading}
        />
      }
      secondaryToolbar={
        <>
          <div />
          <LogPdfExportDialog
            locationId={locationId}
            logType="narcotic_signout"
            rangeKind="date"
            defaultRange={{ dateFrom: currentDate, dateTo: currentDate }}
            availableDateValues={availableDateValues}
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
          entityLabel="log"
          onSaveDraft={() => save("draft")}
          onSaveComplete={() => save("complete")}
          onRevertToDraft={() => save("draft")}
        />
      }
      belowContent={
        <RecentLogChangesPanel
          locationId={locationId}
          logType="narcotic_signout"
          logKey=""
          logDate={currentDate}
          refreshKey={auditRefreshKey}
        />
      }
    >
      <NarcoticSignoutTable
        data={data}
        onChange={handleDataChange}
        locationId={locationId}
        disabled={isDisabled}
        date={currentDate}
        isDraft={status === "draft"}
      />
    </LogFormLayout>
    </>
  )
}
