"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogPdfExportDialog } from "@/components/log-pdf-export-dialog"
import { LogActionBar } from "../../_components/log-action-bar"
import { LogFormLayout } from "../../_components/log-form-layout"
import { CardiacArrestTable } from "./cardiac-arrest-table"
import { emptyCardiacArrestRecordData } from "@/lib/validations/log-entry"
import type { CardiacArrestRecordData } from "@/lib/validations/log-entry"

interface EntryData {
  id: string | null
  data: CardiacArrestRecordData
  status: "draft" | "complete"
  submitted_by_name: string | null
}

interface CardiacArrestLogProps {
  locationId: string
  initialEntry: EntryData | null
  initialDate: string
  /** YYYY-MM — used for the back button and post-save redirects */
  backMonth?: string
  isAdmin?: boolean
  availableDateValues?: string[]
}

export function CardiacArrestLog({
  locationId,
  initialEntry,
  initialDate,
  backMonth,
  isAdmin = false,
  availableDateValues,
}: CardiacArrestLogProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  const [data, setData] = useState<CardiacArrestRecordData>(() => {
    if (initialEntry?.data) {
      // Backward compat: migrate old flat signature fields to signatures array
      const d = { ...initialEntry.data } as CardiacArrestRecordData & Record<string, unknown>
      if (d.team_leader !== undefined && !d.signatures) {
        d.signatures = [
          { role: "Team Leader", name: String(d.team_leader ?? ""), signature: null, initials: "", signed_at: "" },
          { role: "Recording RN", name: String(d.recording_rn ?? ""), signature: null, initials: "", signed_at: "" },
          { role: "Respiratory Care Practitioner", name: String(d.respiratory_care ?? ""), signature: null, initials: "", signed_at: "" },
          { role: "Medication RN", name: String(d.medication_rn ?? ""), signature: null, initials: "", signed_at: "" },
          { role: "Other", name: String(d.other_sig_1 ?? ""), signature: null, initials: "", signed_at: "" },
          { role: "Other", name: String(d.other_sig_2 ?? ""), signature: null, initials: "", signed_at: "" },
        ]
        delete d.team_leader
        delete d.recording_rn
        delete d.respiratory_care
        delete d.medication_rn
        delete d.other_sig_1
        delete d.other_sig_2
      }
      return d as CardiacArrestRecordData
    }
    const empty = emptyCardiacArrestRecordData()
    // Pre-fill arrest_date with today
    empty.arrest_date = initialDate
    return empty
  })
  const [status, setStatus] = useState<"draft" | "complete">(initialEntry?.status ?? "draft")
  const [dirty, setDirty] = useState(false)
  const [entryId] = useState<string | null>(initialEntry?.id ?? null)

  const handleDataChange = useCallback((newData: CardiacArrestRecordData) => {
    setData(newData)
    setDirty(true)
  }, [])

  async function save(newStatus: "draft" | "complete") {
    setSaving(true)
    try {
      // Keep a stable blank key for this date-based event log to avoid duplicates on edit.
      const logKey = ""

      const res = await fetch(`/api/locations/${locationId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_type: "cardiac_arrest_record",
          log_key: logKey,
          log_date: data.arrest_date || initialDate,
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

      // After saving a new entry, redirect to include the ID in the URL
      const result = await res.json()
      const monthParam = backMonth ? `&month=${backMonth}` : ""
      if (!entryId && result?.id) {
        startTransition(() => {
          router.replace(`/logs/cardiac-arrest?loc=${locationId}&id=${result.id}${monthParam}`)
        })
      } else {
        startTransition(() => {
          router.refresh()
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const isDisabled = status === "complete"

  return (
    <div className="space-y-4 overflow-hidden max-w-full">
      {/* Back button */}
      {backMonth && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 -ml-2 text-xs text-muted-foreground"
          onClick={() =>
            startTransition(() => {
              router.push(`/logs/cardiac-arrest?loc=${locationId}&month=${backMonth}`)
            })
          }
        >
          <ChevronLeft className="size-3.5 mr-0.5" />
          Back to Records
        </Button>
      )}

      <LogFormLayout
        title="Cardiac Arrest Record"
        status={status}
        dirty={dirty}
        secondaryToolbar={
          <>
            <div />
            {entryId ? (
              <LogPdfExportDialog
                locationId={locationId}
                logType="cardiac_arrest_record"
                rangeKind="date"
                defaultRange={{
                  dateFrom: data.arrest_date || initialDate,
                  dateTo: data.arrest_date || initialDate,
                }}
                availableDateValues={availableDateValues}
                hasUnsavedChanges={dirty}
                triggerLabel="Export This Record"
              />
            ) : (
              <div />
            )}
          </>
        }
        footerActions={
          <LogActionBar
            status={status}
            dirty={dirty}
            saving={saving}
            isAdmin={isAdmin}
            entityLabel="record"
            onSaveDraft={() => save("draft")}
            onSaveComplete={() => save("complete")}
            onRevertToDraft={() => save("draft")}
          />
        }
      >
        <CardiacArrestTable
          data={data}
          onChange={handleDataChange}
          locationId={locationId}
          disabled={isDisabled}
          isDraft={status === "draft"}
        />
      </LogFormLayout>
    </div>
  )
}
