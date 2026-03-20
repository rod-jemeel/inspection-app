"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Save, CalendarIcon, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { InventoryTable } from "./inventory-table"
import { LogPdfExportDialog } from "@/components/log-pdf-export-dialog"
import { RecentLogChangesPanel } from "../../_components/recent-log-changes-panel"
import {
  normalizeInventoryDate,
  parseInventoryDate,
  prepareInventoryRowsForSave,
  sanitizeInventoryRowsForEdit,
  isMeaningfulInventoryRow,
} from "@/lib/logs/inventory"
import { emptyInventoryLogData } from "@/lib/validations/log-entry"
import type { InventoryLogData, PresetDrug } from "@/lib/validations/log-entry"
import { useStartInstance } from "@/hooks/use-start-instance"

interface EntryData {
  id: string | null
  data: InventoryLogData
  status: "draft" | "complete"
  submitted_by_name: string | null
}

interface InventoryLedgerProps {
  locationId: string
  drugSlug: string
  drugLabel: string
  presetDrug?: PresetDrug
  initialEntry: EntryData | null
  isAdmin?: boolean
  instanceId?: string | null
}

function countMeaningfulRows(rows: InventoryLogData["rows"]): number {
  return rows.filter(isMeaningfulInventoryRow).length
}

function getInitialInventoryMonth(entry: EntryData | null): Date {
  const parsedDates = entry?.data.rows
    .map((row) => parseInventoryDate(row.date))
    .filter((d): d is Date => Boolean(d))

  if (!parsedDates || parsedDates.length === 0) {
    return startOfMonth(new Date())
  }

  const latest = parsedDates.reduce((max, d) => (d > max ? d : max), parsedDates[0])
  return startOfMonth(latest)
}

export function InventoryLedger({
  locationId,
  drugSlug,
  presetDrug,
  initialEntry,
  isAdmin = false,
  instanceId = null,
}: InventoryLedgerProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  useStartInstance(locationId, instanceId)
  const [saving, setSaving] = useState(false)

  const [data, setData] = useState<InventoryLogData>(() => {
    if (initialEntry?.data) {
      return {
        ...initialEntry.data,
        rows: sanitizeInventoryRowsForEdit(initialEntry.data.rows ?? []),
      }
    }
    // Pre-fill from preset drug when creating a new ledger
    const empty = emptyInventoryLogData()
    if (presetDrug) {
      empty.drug_name = presetDrug.drug_name
      empty.strength = presetDrug.strength
      empty.size_qty = presetDrug.size_qty
    }
    return empty
  })
  const [dirty, setDirty] = useState(false)
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState<Date>(
    () => getInitialInventoryMonth(initialEntry),
  )

  // Rows with index < lockedRowCount are read-only (already saved to DB)
  const [lockedRowCount, setLockedRowCount] = useState(
    () => initialEntry ? countMeaningfulRows(sanitizeInventoryRowsForEdit(initialEntry.data.rows ?? [])) : 0
  )

  const handleDataChange = useCallback((newData: InventoryLogData) => {
    setData(newData)
    setDirty(true)
  }, [])

  async function save() {
    setSaving(true)
    try {
      const { rows, lockedRowCount: nextLockedRowCount } = prepareInventoryRowsForSave(data)
      const nextData = { ...data, rows }

      const res = await fetch(`/api/locations/${locationId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_type: "controlled_substance_inventory",
          log_key: drugSlug,
          log_date: "1970-01-01",
          data: nextData,
          // Perpetual inventory should remain editable; persist as draft/ongoing.
          status: "draft",
          ...(instanceId ? { inspection_instance_id: instanceId } : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err?.error?.message ?? "Failed to save")
        return
      }

      setData(nextData)
      setDirty(false)
      setAuditRefreshKey((k) => k + 1)

      // After save, lock all meaningful persisted rows.
      setLockedRowCount(nextLockedRowCount)

      startTransition(() => {
        router.refresh()
      })
    } finally {
      setSaving(false)
    }
  }

  const isDisabled = false
  const monthRange = {
    from: startOfMonth(selectedMonth),
    to: endOfMonth(selectedMonth),
  }
  const nonEmptyRowDates = data.rows
    .map((row) => normalizeInventoryDate(row.date))
    .filter((v): v is string => Boolean(v))
    .sort()
  const availableRange = nonEmptyRowDates.length > 0
    ? { from: nonEmptyRowDates[0], to: nonEmptyRowDates[nonEmptyRowDates.length - 1] }
    : undefined

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            ongoing
          </Badge>
          {dirty && !isDisabled && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <LogPdfExportDialog
            locationId={locationId}
            logType="controlled_substance_inventory"
            rangeKind="date"
            defaultRange={{
              dateFrom: format(monthRange.from, "yyyy-MM-dd"),
              dateTo: format(monthRange.to, "yyyy-MM-dd"),
            }}
            defaultDrugSlug={drugSlug}
            availableDateRange={availableRange}
            availableDateValues={nonEmptyRowDates}
            hasUnsavedChanges={dirty}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 justify-start text-left text-xs font-normal")}
              >
                <CalendarIcon className="mr-1.5 size-3" />
                {format(selectedMonth, "MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="single"
                captionLayout="dropdown"
                startMonth={new Date(2020, 0, 1)}
                endMonth={new Date(2035, 11, 1)}
                defaultMonth={selectedMonth}
                selected={selectedMonth}
                onSelect={(date) => {
                  if (date) setSelectedMonth(startOfMonth(date))
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>

      </div>

      {/* Table */}
      <InventoryTable
        data={data}
        onChange={handleDataChange}
        locationId={locationId}
        disabled={isDisabled}
        lockedRowCount={isAdmin ? 0 : lockedRowCount}
        dateRange={monthRange}
      />

      {/* Save actions */}
      <div className="sticky bottom-0 z-20 border-t border-border/50 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={save}
          disabled={saving || !dirty}
        >
          <Save className="mr-1 size-3" />
          {saving ? "Saving\u2026" : "Save Inventory"}
        </Button>
      </div>

      <RecentLogChangesPanel
        locationId={locationId}
        logType="controlled_substance_inventory"
        logKey={drugSlug}
        logDate="1970-01-01"
        refreshKey={auditRefreshKey}
      />
    </div>
    </>
  )
}
