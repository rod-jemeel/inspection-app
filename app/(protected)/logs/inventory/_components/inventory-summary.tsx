"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package,
  ShieldCheck,
  CalendarIcon,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { InventoryLogData, InventoryRow } from "@/lib/validations/log-entry"

interface InventoryEntry {
  id: string
  log_key: string
  status: "draft" | "complete"
  data: InventoryLogData
  submitted_by_name: string | null
  updated_at: string
}

interface InventorySummaryProps {
  locationId: string
}

// Helper: Date → YYYY-MM-DD local
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Parse vial volume from size_qty string (e.g., "2mL vials" → 2)
function parseVialVolume(sizeQty: string): number | null {
  const match = sizeQty.match(/([\d.]+)\s*m[lL]/i)
  return match ? parseFloat(match[1]) : null
}

// Estimated average cost per mL for controlled substances
const COST_PER_ML = 15

interface DrugStats {
  slug: string
  drugName: string
  strength: string
  sizeQty: string
  status: "draft" | "complete"
  currentStock: number | null
  initialStock: number | null
  totalRows: number
  // Period-specific (filtered by date range)
  periodUsed: number
  periodWasted: number
  periodOrdered: number
  periodTransactions: number
  // Alerts
  unsignedRows: number
  stockDiscrepancies: number
  lastActivity: string | null
}

export function InventorySummary({ locationId }: InventorySummaryProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<InventoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  async function fetchEntries() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        log_type: "controlled_substance_inventory",
        limit: "50",
      })
      const res = await fetch(`/api/locations/${locationId}/logs?${params}`)
      if (res.ok) {
        const { entries: data } = await res.json()
        setEntries(data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (locationId) fetchEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId])

  // Compute per-drug stats
  const drugStats = useMemo(() => {
    const fromStr = dateRange?.from ? toDateStr(dateRange.from) : ""
    const toStr = dateRange?.to ? toDateStr(dateRange.to) : ""

    return entries.map((entry): DrugStats => {
      const d = entry.data as InventoryLogData
      const rows = d.rows ?? []
      const vialVol = parseVialVolume(d.size_qty)

      // Compute current stock from running balance
      let stock = d.initial_stock ?? 0
      for (const row of rows) {
        const vialsConsumed =
          vialVol && row.amt_used ? Math.ceil(row.amt_used / vialVol) : 0
        const computed = stock + (row.amt_ordered ?? 0) - vialsConsumed
        stock = row.qty_in_stock ?? computed
      }

      // Filter rows by date range for period stats
      const periodRows = rows.filter((row: InventoryRow) => {
        if (!row.date) return false
        if (fromStr && row.date < fromStr) return false
        if (toStr && row.date > toStr) return false
        return true
      })

      // Period aggregates
      let periodUsed = 0
      let periodWasted = 0
      let periodOrdered = 0
      for (const row of periodRows) {
        periodUsed += row.amt_used ?? 0
        periodWasted += row.amt_wasted ?? 0
        periodOrdered += row.amt_ordered ?? 0
      }

      // Alerts: unsigned rows (have data but no RN sig)
      const unsignedRows = rows.filter(
        (r: InventoryRow) =>
          (r.patient_name?.trim() || r.amt_used !== null || r.amt_ordered !== null) &&
          !r.rn_sig,
      ).length

      // Stock discrepancies: check if manual overrides differ significantly from computed
      let stockDiscrepancies = 0
      let runStock = d.initial_stock ?? 0
      for (const row of rows) {
        const vialsConsumed =
          vialVol && row.amt_used ? Math.ceil(row.amt_used / vialVol) : 0
        const computed = runStock + (row.amt_ordered ?? 0) - vialsConsumed
        if (row.qty_in_stock !== null && row.qty_in_stock !== computed) {
          stockDiscrepancies++
        }
        runStock = row.qty_in_stock ?? computed
      }

      // Last activity
      const datedRows = rows.filter((r: InventoryRow) => r.date?.trim())
      const lastRow = datedRows[datedRows.length - 1]

      return {
        slug: entry.log_key,
        drugName: d.drug_name || entry.log_key,
        strength: d.strength,
        sizeQty: d.size_qty,
        status: entry.status,
        currentStock: stock,
        initialStock: d.initial_stock,
        totalRows: datedRows.length,
        periodUsed,
        periodWasted,
        periodOrdered,
        periodTransactions: periodRows.length,
        unsignedRows,
        stockDiscrepancies,
        lastActivity: lastRow?.date ?? null,
      }
    })
  }, [entries, dateRange])

  // Aggregate stats
  const totals = useMemo(() => {
    if (drugStats.length === 0) return null

    let totalUsed = 0
    let totalWasted = 0
    let totalOrdered = 0
    let totalUnsigned = 0
    let totalDiscrepancies = 0
    let totalRows = 0

    for (const s of drugStats) {
      totalUsed += s.periodUsed
      totalWasted += s.periodWasted
      totalOrdered += s.periodOrdered
      totalUnsigned += s.unsignedRows
      totalDiscrepancies += s.stockDiscrepancies
      totalRows += s.totalRows
    }

    const wasteRate = totalUsed > 0 ? ((totalWasted / (totalUsed + totalWasted)) * 100) : 0
    const revenueLoss = totalWasted * COST_PER_ML
    const complianceRaw = totalRows > 0
      ? ((totalRows - totalUnsigned - totalDiscrepancies) / totalRows) * 100
      : 100
    const complianceScore = Math.max(0, Math.min(100, complianceRaw))

    return {
      drugCount: drugStats.length,
      totalUsed,
      totalWasted,
      totalOrdered,
      totalUnsigned,
      totalDiscrepancies,
      totalRows,
      wasteRate,
      revenueLoss,
      complianceScore,
    }
  }, [drugStats])

  const isFiltered = !!(dateRange?.from || dateRange?.to)

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Usage period:
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 justify-start text-left text-xs font-normal",
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
                "All time"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
        {isFiltered && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setDateRange(undefined)}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Loading\u2026
        </div>
      )}

      {/* Stats cards */}
      {totals && !loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Drugs Tracked */}
          <div className="border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="size-3.5" />
              <span>Drugs Tracked</span>
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {totals.drugCount}
            </p>
          </div>

          {/* Revenue Loss Estimation */}
          <div className="border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DollarSign className="size-3.5" />
              <span>Est. Revenue Loss</span>
            </div>
            <p
              className={cn(
                "mt-1 text-sm font-semibold tabular-nums",
                totals.revenueLoss > 0 && "text-destructive",
              )}
            >
              ${totals.revenueLoss.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totals.totalWasted} mL wasted @ ${COST_PER_ML}/mL
            </p>
          </div>

          {/* Waste Rate */}
          <div className="border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingDown className="size-3.5" />
              <span>Waste Rate</span>
            </div>
            <p
              className={cn(
                "mt-1 text-sm font-semibold tabular-nums",
                totals.wasteRate > 20 && "text-amber-600",
              )}
            >
              {totals.wasteRate.toFixed(1)}%
            </p>
          </div>

          {/* Compliance Score */}
          <div className="border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              <span>Compliance</span>
            </div>
            <p
              className={cn(
                "mt-1 text-sm font-semibold tabular-nums",
                totals.complianceScore > 95 && "text-emerald-600",
                totals.complianceScore >= 80 && totals.complianceScore <= 95 && "text-amber-600",
                totals.complianceScore < 80 && "text-destructive",
              )}
            >
              {totals.complianceScore.toFixed(1)}%
            </p>
            <div className="mt-0.5 space-y-0.5">
              {totals.totalDiscrepancies > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {totals.totalDiscrepancies} discrepanc{totals.totalDiscrepancies === 1 ? "y" : "ies"}
                </p>
              )}
              {totals.totalUnsigned > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {totals.totalUnsigned} unsigned
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-drug breakdown table */}
      {!loading && drugStats.length > 0 && (
        <div className="overflow-x-auto border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Drug</th>
                <th className="px-3 py-2 text-left font-medium">Strength</th>
                <th className="px-3 py-2 text-center font-medium">Status</th>
                <th className="px-3 py-2 text-center font-medium">
                  Current Stock
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  {isFiltered ? "Period" : "Total"} Used
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  {isFiltered ? "Period" : "Total"} Wasted
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  Waste %
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  {isFiltered ? "Period" : "Total"} Ordered
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  Transactions
                </th>
                <th className="px-3 py-2 text-center font-medium">Alerts</th>
                <th className="px-3 py-2 text-left font-medium">
                  Last Activity
                </th>
              </tr>
            </thead>
            <tbody>
              {drugStats.map((drug) => {
                const wastePercent =
                  drug.periodUsed + drug.periodWasted > 0
                    ? (drug.periodWasted / (drug.periodUsed + drug.periodWasted)) * 100
                    : 0
                const stockDepleted =
                  drug.initialStock != null &&
                  drug.currentStock != null &&
                  drug.initialStock > 0 &&
                  drug.currentStock < drug.initialStock * 0.5
                const stockIncreased =
                  drug.initialStock != null &&
                  drug.currentStock != null &&
                  drug.currentStock > drug.initialStock
                const lowStock = drug.currentStock != null && drug.currentStock < 3

                return (
                  <tr
                    key={drug.slug}
                    className="border-b cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() =>
                      router.push(`/logs/inventory?loc=${locationId}&drug=${drug.slug}`)
                    }
                  >
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {drug.drugName || drug.slug}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {drug.strength || "\u2014"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge
                        variant={
                          drug.status === "complete" ? "default" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {drug.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums font-semibold">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          lowStock && "text-destructive",
                        )}
                      >
                        {drug.currentStock ?? "\u2014"}
                        {stockIncreased && (
                          <TrendingUp className="size-3 text-emerald-600" />
                        )}
                        {stockDepleted && (
                          <TrendingDown className="size-3 text-destructive" />
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {drug.periodUsed || "\u2014"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-center tabular-nums",
                        drug.periodWasted > 0 && "text-amber-600",
                      )}
                    >
                      {drug.periodWasted || "\u2014"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-center tabular-nums",
                        wastePercent > 15 && "text-destructive font-medium",
                        wastePercent >= 5 && wastePercent <= 15 && "text-amber-600",
                        wastePercent > 0 && wastePercent < 5 && "text-emerald-600",
                      )}
                    >
                      {wastePercent > 0 ? `${wastePercent.toFixed(1)}%` : "\u2014"}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {drug.periodOrdered || "\u2014"}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {isFiltered ? drug.periodTransactions : drug.totalRows}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {drug.unsignedRows > 0 || drug.stockDiscrepancies > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-600">
                          <AlertTriangle className="size-3" />
                          {drug.unsignedRows + drug.stockDiscrepancies}
                        </span>
                      ) : (
                        <span className="text-emerald-600">{"\u2713"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {drug.lastActivity ?? "\u2014"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-center tabular-nums">
                  {totals?.totalUsed || "\u2014"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-center tabular-nums",
                    (totals?.totalWasted ?? 0) > 0 && "text-amber-600",
                  )}
                >
                  {totals?.totalWasted || "\u2014"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-center tabular-nums",
                    (totals?.wasteRate ?? 0) > 15 && "text-destructive font-medium",
                    (totals?.wasteRate ?? 0) >= 5 && (totals?.wasteRate ?? 0) <= 15 && "text-amber-600",
                  )}
                >
                  {(totals?.wasteRate ?? 0) > 0 ? `${totals!.wasteRate.toFixed(1)}%` : "\u2014"}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {totals?.totalOrdered || "\u2014"}
                </td>
                <td className="px-3 py-2" colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No inventory entries found. Start by selecting a drug and recording
          transactions.
        </div>
      )}

      {/* Entry count */}
      {!loading && entries.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Tracking {drugStats.length} drug
          {drugStats.length === 1 ? "" : "s"} &middot;{" "}
          {drugStats.reduce((s, d) => s + d.totalRows, 0)} total transactions
        </p>
      )}
    </div>
  )
}
