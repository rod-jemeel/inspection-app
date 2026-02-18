"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, AlertTriangle, TrendingDown, Users, CalendarX } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NarcoticLogData } from "@/lib/validations/log-entry"

interface LogEntrySummary {
  id: string
  log_date: string
  status: "draft" | "complete"
  data: NarcoticLogData
  submitted_by_name: string | null
}

interface NarcoticSummaryProps {
  locationId: string
}

export function NarcoticSummary({ locationId }: NarcoticSummaryProps) {
  const router = useRouter()

  // Default range: last 30 days
  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]

  const [from, setFrom] = useState(thirtyDaysAgo)
  const [to, setTo] = useState(today)
  const [entries, setEntries] = useState<LogEntrySummary[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchEntries() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        log_type: "narcotic_log",
        from,
        to,
        limit: "365",
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

  function handleSearch() {
    fetchEntries()
  }

  function navigateToDate(date: string) {
    router.push(`/logs/narcotic?loc=${locationId}&date=${date}`)
  }

  // -----------------------------------------------------------------------
  // Computed aggregates
  // -----------------------------------------------------------------------

  const stats = useMemo(() => {
    if (entries.length === 0) return null

    let totalVersedUsed = 0
    let totalFentanylUsed = 0
    let totalDrug3Used = 0
    let totalVersedWaste = 0
    let totalFentanylWaste = 0
    let totalDrug3Waste = 0
    let totalPatients = 0
    let discrepancies: { date: string; drug: string; expected: number; actual: number }[] = []
    let completedCount = 0
    let draftCount = 0

    for (const entry of entries) {
      const d = entry.data
      if (entry.status === "complete") completedCount++
      else draftCount++

      const patients = d.rows?.filter((r) => r.patient?.trim()).length ?? 0
      totalPatients += patients

      // Sum usage from patient rows
      const versedUsed = d.rows?.reduce((s, r) => s + ((r.versed as number | null) ?? 0), 0) ?? 0
      const fentanylUsed = d.rows?.reduce((s, r) => s + ((r.fentanyl as number | null) ?? 0), 0) ?? 0
      const drug3Used = d.rows?.reduce((s, r) => s + ((r.drug3 as number | null) ?? 0), 0) ?? 0

      totalVersedUsed += versedUsed
      totalFentanylUsed += fentanylUsed
      totalDrug3Used += drug3Used

      // Sum waste
      totalVersedWaste += d.rows?.reduce((s, r) => s + ((r.versed_waste as number | null) ?? 0), 0) ?? 0
      totalFentanylWaste += d.rows?.reduce((s, r) => s + ((r.fentanyl_waste as number | null) ?? 0), 0) ?? 0
      totalDrug3Waste += d.rows?.reduce((s, r) => s + ((r.drug3_waste as number | null) ?? 0), 0) ?? 0

      // Check discrepancies: End Count should == Beginning Count - Used
      const bc = d.beginning_count
      const ec = d.end_count
      const dateStr = entry.log_date

      if (bc?.versed !== null && ec?.versed !== null) {
        const expected = (bc.versed ?? 0) - versedUsed
        if (ec.versed !== expected) {
          discrepancies.push({ date: dateStr, drug: "Versed", expected, actual: ec.versed ?? 0 })
        }
      }
      if (bc?.fentanyl !== null && ec?.fentanyl !== null) {
        const expected = (bc.fentanyl ?? 0) - fentanylUsed
        if (ec.fentanyl !== expected) {
          discrepancies.push({ date: dateStr, drug: "Fentanyl", expected, actual: ec.fentanyl ?? 0 })
        }
      }
    }

    // Find missing days in the date range (weekdays only)
    const entryDates = new Set(entries.map((e) => e.log_date))
    const missingDays: string[] = []
    const start = new Date(from + "T00:00:00")
    const end = new Date(to + "T00:00:00")
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day === 0 || day === 6) continue // skip weekends
      const iso = d.toISOString().split("T")[0]
      if (!entryDates.has(iso)) missingDays.push(iso)
    }

    return {
      totalVersedUsed,
      totalFentanylUsed,
      totalDrug3Used,
      totalVersedWaste,
      totalFentanylWaste,
      totalDrug3Waste,
      totalPatients,
      discrepancies,
      completedCount,
      draftCount,
      missingDays,
    }
  }, [entries, from, to])

  // Check if any entry uses drug3
  const hasDrug3 = useMemo(() => {
    return entries.some((e) => e.data.drug3_name?.trim())
  }, [entries])

  const drug3Name = useMemo(() => {
    return entries.find((e) => e.data.drug3_name?.trim())?.data.drug3_name || "Drug 3"
  }, [entries])

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-auto text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-auto text-xs"
          />
        </div>
        <Button size="sm" className="h-8" onClick={handleSearch} disabled={loading}>
          <Search className="mr-1 size-3" />
          Search
        </Button>
      </div>

      {/* Stats cards */}
      {stats && !loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              <span>Total Patients</span>
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">{stats.totalPatients}</p>
          </div>
          <div className="rounded border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingDown className="size-3.5" />
              <span>Total Usage</span>
            </div>
            <div className="mt-1 space-y-0.5">
              <p className="text-xs tabular-nums">Versed: <span className="font-semibold">{stats.totalVersedUsed}</span></p>
              <p className="text-xs tabular-nums">Fentanyl: <span className="font-semibold">{stats.totalFentanylUsed}</span></p>
              {hasDrug3 && <p className="text-xs tabular-nums">{drug3Name}: <span className="font-semibold">{stats.totalDrug3Used}</span></p>}
            </div>
          </div>
          <div className="rounded border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingDown className="size-3.5" />
              <span>Total Waste</span>
            </div>
            <div className="mt-1 space-y-0.5">
              <p className="text-xs tabular-nums">Versed: <span className="font-semibold">{stats.totalVersedWaste}</span></p>
              <p className="text-xs tabular-nums">Fentanyl: <span className="font-semibold">{stats.totalFentanylWaste}</span></p>
              {hasDrug3 && <p className="text-xs tabular-nums">{drug3Name}: <span className="font-semibold">{stats.totalDrug3Waste}</span></p>}
            </div>
          </div>
          <div className="rounded border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {stats.discrepancies.length > 0 || stats.missingDays.length > 0 ? (
                <AlertTriangle className="size-3.5 text-amber-500" />
              ) : (
                <CalendarX className="size-3.5" />
              )}
              <span>Alerts</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {stats.discrepancies.length > 0 && (
                <p className="text-xs text-amber-600">{stats.discrepancies.length} count discrepanc{stats.discrepancies.length === 1 ? "y" : "ies"}</p>
              )}
              {stats.missingDays.length > 0 && (
                <p className="text-xs text-amber-600">{stats.missingDays.length} missing weekday{stats.missingDays.length === 1 ? "" : "s"}</p>
              )}
              {stats.draftCount > 0 && (
                <p className="text-xs text-muted-foreground">{stats.draftCount} draft{stats.draftCount === 1 ? "" : "s"}</p>
              )}
              {stats.discrepancies.length === 0 && stats.missingDays.length === 0 && stats.draftCount === 0 && (
                <p className="text-xs text-emerald-600">All clear</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy details */}
      {stats && stats.discrepancies.length > 0 && !loading && (
        <div className="rounded border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3.5" />
            Count Discrepancies
          </div>
          <div className="space-y-1">
            {stats.discrepancies.map((disc, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                <button
                  className="font-medium underline hover:no-underline"
                  onClick={() => navigateToDate(disc.date)}
                >
                  {new Date(disc.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </button>
                {" "}{disc.drug}: expected {disc.expected}, recorded {disc.actual}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Missing days warning */}
      {stats && stats.missingDays.length > 0 && stats.missingDays.length <= 10 && !loading && (
        <div className="rounded border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <CalendarX className="size-3.5" />
            Missing Weekday Logs
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.missingDays.map((d) => (
              <button
                key={d}
                className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                onClick={() => navigateToDate(d)}
              >
                {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="overflow-x-auto rounded border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-center font-medium">Begin V</th>
              <th className="px-3 py-2 text-center font-medium">Begin F</th>
              {hasDrug3 && <th className="px-3 py-2 text-center font-medium">Begin {drug3Name.slice(0, 6)}</th>}
              <th className="px-3 py-2 text-center font-medium"># Patients</th>
              <th className="px-3 py-2 text-center font-medium">Used V</th>
              <th className="px-3 py-2 text-center font-medium">Used F</th>
              <th className="px-3 py-2 text-center font-medium">Waste V</th>
              <th className="px-3 py-2 text-center font-medium">Waste F</th>
              <th className="px-3 py-2 text-center font-medium">End V</th>
              <th className="px-3 py-2 text-center font-medium">End F</th>
              <th className="px-3 py-2 text-left font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={hasDrug3 ? 14 : 13} className="px-3 py-8 text-center text-muted-foreground">
                  Loading\u2026
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={hasDrug3 ? 14 : 13} className="px-3 py-8 text-center text-muted-foreground">
                  No entries found for this date range
                </td>
              </tr>
            )}
            {!loading &&
              entries.map((entry) => {
                const d = entry.data
                const patientCount = d.rows?.filter((r) => r.patient?.trim()).length ?? 0
                const versedUsed = d.rows?.reduce((s, r) => s + ((r.versed as number | null) ?? 0), 0) ?? 0
                const fentanylUsed = d.rows?.reduce((s, r) => s + ((r.fentanyl as number | null) ?? 0), 0) ?? 0
                const versedWaste = d.rows?.reduce((s, r) => s + ((r.versed_waste as number | null) ?? 0), 0) ?? 0
                const fentanylWaste = d.rows?.reduce((s, r) => s + ((r.fentanyl_waste as number | null) ?? 0), 0) ?? 0

                // Check for discrepancy
                const versedExpected = (d.beginning_count?.versed ?? 0) - versedUsed
                const fentanylExpected = (d.beginning_count?.fentanyl ?? 0) - fentanylUsed
                const versedDisc = d.end_count?.versed !== null && d.beginning_count?.versed !== null && d.end_count.versed !== versedExpected
                const fentanylDisc = d.end_count?.fentanyl !== null && d.beginning_count?.fentanyl !== null && d.end_count.fentanyl !== fentanylExpected

                return (
                  <tr
                    key={entry.id}
                    className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                    onClick={() => navigateToDate(entry.log_date)}
                  >
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {new Date(entry.log_date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={entry.status === "complete" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{d.beginning_count?.versed ?? "-"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{d.beginning_count?.fentanyl ?? "-"}</td>
                    {hasDrug3 && <td className="px-3 py-2 text-center tabular-nums">{d.beginning_count?.drug3 ?? "-"}</td>}
                    <td className="px-3 py-2 text-center tabular-nums">{patientCount}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{versedUsed || "-"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{fentanylUsed || "-"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{versedWaste || "-"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{fentanylWaste || "-"}</td>
                    <td className={cn("px-3 py-2 text-center tabular-nums", versedDisc && "font-semibold text-amber-600")}>
                      {d.end_count?.versed ?? "-"}
                      {versedDisc && <AlertTriangle className="ml-0.5 inline size-3 text-amber-500" />}
                    </td>
                    <td className={cn("px-3 py-2 text-center tabular-nums", fentanylDisc && "font-semibold text-amber-600")}>
                      {d.end_count?.fentanyl ?? "-"}
                      {fentanylDisc && <AlertTriangle className="ml-0.5 inline size-3 text-amber-500" />}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {entry.submitted_by_name ?? "-"}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Entry count */}
      {!loading && entries.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Showing {entries.length} entr{entries.length === 1 ? "y" : "ies"} &middot;{" "}
          {stats?.completedCount} complete, {stats?.draftCount} draft
        </p>
      )}
    </div>
  )
}
