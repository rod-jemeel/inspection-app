"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  isAdmin?: boolean
}

export function CardiacArrestLog({
  locationId,
  initialEntry,
  initialDate,
  isAdmin = false,
}: CardiacArrestLogProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  const [data, setData] = useState<CardiacArrestRecordData>(() => {
    if (initialEntry?.data) return initialEntry.data
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
      // Use entry ID as log_key for existing entries, empty string for new
      const logKey = entryId ?? ""

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
      if (!entryId && result?.id) {
        startTransition(() => {
          router.replace(`/logs/cardiac-arrest?loc=${locationId}&id=${result.id}`)
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
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Cardiac Arrest Record</h3>
        <Badge variant={status === "complete" ? "default" : "secondary"} className="text-[10px]">
          {status}
        </Badge>
        {dirty && !isDisabled && (
          <span className="text-xs text-amber-600">Unsaved changes</span>
        )}
      </div>

      {/* Table */}
      <CardiacArrestTable
        data={data}
        onChange={handleDataChange}
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
            This record has been submitted as complete. Contact an admin to revert.
          </p>
        )}
      </div>
    </div>
  )
}
