"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { InventoryTable } from "./inventory-table"
import { LogPdfExportDialog } from "@/components/log-pdf-export-dialog"
import { RecentLogChangesPanel } from "../../_components/recent-log-changes-panel"
import { emptyInventoryLogData } from "@/lib/validations/log-entry"
import type { InventoryLogData, PresetDrug } from "@/lib/validations/log-entry"

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
}

// Count non-empty rows from saved data to determine lock boundary
function countNonEmptyRows(rows: InventoryLogData["rows"]): number {
  let count = 0
  for (const row of rows) {
    const hasData =
      row.date.trim() ||
      row.patient_name.trim() ||
      row.transaction.trim() ||
      row.qty_in_stock !== null ||
      row.amt_ordered !== null ||
      row.amt_used !== null ||
      row.amt_wasted !== null ||
      row.rn_sig ||
      row.witness_sig
    if (hasData) count++
    else break // stop at first empty row (trailing empties aren't locked)
  }
  return count
}

function normalizeInventoryDate(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [m, d, y] = value.split("/").map(Number)
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
}

function parseInventoryRowDate(value: string): Date | undefined {
  if (!value) return undefined

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const [, y, m, d] = iso
    const parsed = new Date(Number(y), Number(m) - 1, Number(d))
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const [, m, d, y] = us
    const parsed = new Date(Number(y), Number(m) - 1, Number(d))
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  return undefined
}

function getInitialInventoryMonth(entry: EntryData | null): Date {
  const parsedDates = entry?.data.rows
    .map((row) => parseInventoryRowDate(row.date))
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
}: InventoryLedgerProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  const [data, setData] = useState<InventoryLogData>(() => {
    if (initialEntry?.data) return initialEntry.data
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
    () => initialEntry ? countNonEmptyRows(initialEntry.data.rows) : 0
  )

  const handleDataChange = useCallback((newData: InventoryLogData) => {
    setData(newData)
    setDirty(true)
  }, [])

  async function save() {
    setSaving(true)
    try {
      // Auto-calculate running qty_in_stock (in vials) for each row
      // Parse vial volume from size_qty (e.g., "2mL vials" -> 2)
      const vialMatch = data.size_qty.match(/([\d.]+)\s*m[lL]/i)
      const vialVol = vialMatch ? parseFloat(vialMatch[1]) : null
      const rows: typeof data.rows = []
      let prevStock = data.initial_stock ?? 0
      for (const row of data.rows) {
        const vialsConsumed = vialVol && row.amt_used
          ? Math.ceil(row.amt_used / vialVol)
          : 0
        const computed = prevStock + (row.amt_ordered ?? 0) - vialsConsumed
        const filled = { ...row, qty_in_stock: row.qty_in_stock ?? computed }
        rows.push(filled)
        prevStock = filled.qty_in_stock ?? computed
      }

      const res = await fetch(`/api/locations/${locationId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_type: "controlled_substance_inventory",
          log_key: drugSlug,
          log_date: "1970-01-01",
          data: { ...data, rows },
          // Perpetual inventory should remain editable; persist as draft/ongoing.
          status: "draft",
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err?.error?.message ?? "Failed to save")
        return
      }

      setDirty(false)
      setAuditRefreshKey((k) => k + 1)

      // After save, lock all non-empty rows (they're now persisted)
      setLockedRowCount(countNonEmptyRows(rows))

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
  )
}
