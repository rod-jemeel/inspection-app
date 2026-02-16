"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NarcoticTable } from "./narcotic-table"
import { NarcoticSummary } from "./narcotic-summary"
import { emptyNarcoticLogData } from "@/lib/validations/log-entry"
import type { NarcoticLogData } from "@/lib/validations/log-entry"

interface LogEntryData {
  id: string | null
  log_date: string
  data: NarcoticLogData
  status: "draft" | "complete"
  submitted_by_name: string | null
}

interface NarcoticLogProps {
  locationId: string
  initialDate: string
  initialEntry: LogEntryData | null
  isAdmin?: boolean
}

export function NarcoticLog({ locationId, initialDate, initialEntry, isAdmin = false }: NarcoticLogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  const [date] = useState(initialDate)
  const [data, setData] = useState<NarcoticLogData>(
    initialEntry?.data ?? emptyNarcoticLogData()
  )
  const [status, setStatus] = useState<"draft" | "complete">(initialEntry?.status ?? "draft")
  const [dirty, setDirty] = useState(false)

  // ---------------------------------------------------------------------------
  // Date navigation (passed to table)
  // ---------------------------------------------------------------------------

  const navigateDate = useCallback((offset: number) => {
    const d = new Date(date + "T00:00:00")
    d.setDate(d.getDate() + offset)
    const newDate = d.toISOString().split("T")[0]
    startTransition(() => {
      router.push(`/logs/narcotic?loc=${locationId}&date=${newDate}`)
    })
  }, [date, locationId, router])

  const goToDate = useCallback((newDate: string) => {
    startTransition(() => {
      router.push(`/logs/narcotic?loc=${locationId}&date=${newDate}`)
    })
  }, [locationId, router])

  // ---------------------------------------------------------------------------
  // Data change
  // ---------------------------------------------------------------------------

  const handleDataChange = useCallback((newData: NarcoticLogData) => {
    setData(newData)
    setDirty(true)
  }, [])

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function save(newStatus: "draft" | "complete") {
    // Require signatures on non-empty patient rows when submitting as complete
    if (newStatus === "complete") {
      const missingRows = data.rows
        .map((row, i) => ({ row, idx: i + 1 }))
        .filter(({ row }) => row.patient.trim())
        .filter(({ row }) => !row.sig1 || !row.sig2)

      if (missingRows.length > 0) {
        const rowNums = missingRows.map((r) => r.idx).join(", ")
        alert(`Patient row${missingRows.length > 1 ? "s" : ""} ${rowNums} ${missingRows.length > 1 ? "are" : "is"} missing licensed staff signature(s). Both signatures are required for each patient row.`)
        return
      }
    }

    setSaving(true)
    try {
      // Fill in computed end counts for any fields the user hasn't manually overridden
      const rows = data.rows
      const sum = (key: keyof typeof rows[0]) =>
        rows.reduce((s, r) => s + ((r[key] as number | null) ?? 0), 0)
      const bc = data.beginning_count
      const ec = data.end_count
      const filledEndCount = {
        versed: ec.versed ?? (bc.versed !== null ? bc.versed - sum("versed") : null),
        fentanyl: ec.fentanyl ?? (bc.fentanyl !== null ? bc.fentanyl - sum("fentanyl") : null),
        drug3: ec.drug3 ?? (bc.drug3 !== null ? bc.drug3 - sum("drug3") : null),
        versed_total_waste: ec.versed_total_waste ?? (sum("versed_waste") || null),
        fentanyl_total_waste: ec.fentanyl_total_waste ?? (sum("fentanyl_waste") || null),
        drug3_total_waste: ec.drug3_total_waste ?? (sum("drug3_waste") || null),
      }

      const res = await fetch(`/api/locations/${locationId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_type: "narcotic_log",
          log_date: date,
          data: { ...data, end_count: filledEndCount },
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
    <Tabs defaultValue="fill" className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={status === "complete" ? "default" : "secondary"} className="text-[10px]">
            {status}
          </Badge>
          {dirty && !isDisabled && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}
        </div>

        <TabsList>
          <TabsTrigger value="fill" className="text-xs">Fill</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
        </TabsList>
      </div>

      {/* Fill tab */}
      <TabsContent value="fill" className="space-y-4">
        <NarcoticTable
          data={data}
          onChange={handleDataChange}
          locationId={locationId}
          disabled={isDisabled}
          date={date}
          onNavigateDate={navigateDate}
          onGoToDate={goToDate}
          isPending={isPending}
        />

        {/* Save actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!isDisabled && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => save("draft")}
                disabled={saving || !dirty}
              >
                <Save className="mr-1 size-3" />
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                size="sm"
                onClick={() => save("complete")}
                disabled={saving}
              >
                <CheckCircle2 className="mr-1 size-3" />
                {saving ? "Saving..." : "Submit as Complete"}
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
              {saving ? "Reverting..." : "Revert to Draft"}
            </Button>
          )}
          {isDisabled && !isAdmin && (
            <p className="text-xs text-muted-foreground">
              This log has been submitted as complete. Contact an admin to revert.
            </p>
          )}
        </div>
      </TabsContent>

      {/* Summary tab */}
      <TabsContent value="summary">
        <NarcoticSummary locationId={locationId} />
      </TabsContent>
    </Tabs>
  )
}
