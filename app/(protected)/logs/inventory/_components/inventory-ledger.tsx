"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, CheckCircle2, RotateCcw, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { InventoryTable } from "./inventory-table"
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
  const [status, setStatus] = useState<"draft" | "complete">(initialEntry?.status ?? "draft")
  const [dirty, setDirty] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // Rows with index < lockedRowCount are read-only (already saved to DB)
  const [lockedRowCount, setLockedRowCount] = useState(
    () => initialEntry ? countNonEmptyRows(initialEntry.data.rows) : 0
  )

  const handleDataChange = useCallback((newData: InventoryLogData) => {
    setData(newData)
    setDirty(true)
  }, [])

  async function save(newStatus: "draft" | "complete") {
    // Require signatures on rows with patient data when submitting as complete
    if (newStatus === "complete") {
      const missingRows = data.rows
        .map((row, i) => ({ row, idx: i + 1 }))
        .filter(({ row }) => row.patient_name.trim() || row.amt_used !== null || row.amt_ordered !== null)
        .filter(({ row }) => !row.rn_sig)

      if (missingRows.length > 0) {
        const rowNums = missingRows.map((r) => r.idx).join(", ")
        alert(`Row${missingRows.length > 1 ? "s" : ""} ${rowNums} ${missingRows.length > 1 ? "are" : "is"} missing RN signature. Signature is required for each transaction row.`)
        return
      }
    }

    setSaving(true)
    try {
      // Auto-calculate running qty_in_stock (in vials) for each row
      // Parse vial volume from size_qty (e.g., "2mL vials" → 2)
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

      // After save, lock all non-empty rows (they're now persisted)
      setLockedRowCount(countNonEmptyRows(rows))

      startTransition(() => {
        router.refresh()
      })
    } finally {
      setSaving(false)
    }
  }

  const isDisabled = status === "complete"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={status === "complete" ? "default" : "secondary"} className="text-[10px]">
            {status}
          </Badge>
          {dirty && !isDisabled && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 justify-start text-left text-xs font-normal",
                  !dateRange && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-1.5 size-3" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} –{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  "Filter by date range"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          {dateRange?.from && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setDateRange(undefined)}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <InventoryTable
        data={data}
        onChange={handleDataChange}
        locationId={locationId}
        disabled={isDisabled}
        lockedRowCount={lockedRowCount}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
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
            This inventory has been submitted as complete. Contact an admin to revert.
          </p>
        )}
      </div>
    </div>
  )
}
