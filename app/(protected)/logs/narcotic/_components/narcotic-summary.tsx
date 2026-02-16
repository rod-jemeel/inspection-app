"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
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
        limit: "100",
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

      {/* Results table */}
      <div className="overflow-x-auto rounded border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-center font-medium">Begin Versed</th>
              <th className="px-3 py-2 text-center font-medium">Begin Fentanyl</th>
              <th className="px-3 py-2 text-center font-medium"># Patients</th>
              <th className="px-3 py-2 text-center font-medium">End Versed</th>
              <th className="px-3 py-2 text-center font-medium">End Fentanyl</th>
              <th className="px-3 py-2 text-left font-medium">Submitted By</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No entries found for this date range
                </td>
              </tr>
            )}
            {!loading &&
              entries.map((entry) => {
                const d = entry.data
                const patientCount = d.rows?.filter((r) => r.patient?.trim()).length ?? 0
                return (
                  <tr
                    key={entry.id}
                    className={cn(
                      "cursor-pointer border-b transition-colors hover:bg-muted/30"
                    )}
                    onClick={() => navigateToDate(entry.log_date)}
                  >
                    <td className="px-3 py-2 font-medium">
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
                    <td className="px-3 py-2 text-center">
                      {d.beginning_count?.versed ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {d.beginning_count?.fentanyl ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-center">{patientCount}</td>
                    <td className="px-3 py-2 text-center">
                      {d.end_count?.versed ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {d.end_count?.fentanyl ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {entry.submitted_by_name ?? "-"}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
