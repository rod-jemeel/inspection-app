import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntryByKey, listLogEntries } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { NarcoticCountLog } from "./_components/narcotic-count-log"
import { dailyNarcoticCountLogDataSchema, type DailyNarcoticCountLogData } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Daily Narcotic Count",
}

function normalizeDncDateToIso(value: string): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const mdY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (mdY) {
    const [, m, d, y] = mdY
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, "0")
  const d = String(parsed.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

async function NarcoticCountLoader({
  loc,
  year,
  month,
  instanceId,
}: {
  loc: string
  year: number
  month: number
  instanceId: string | null
}) {
  const { profile } = await requireLocationAccess(loc)

  const logKey = `${year}-${String(month).padStart(2, "0")}`
  const entry = await getLogEntryByKey(loc, "daily_narcotic_count", logKey)
  const { entries: allEntries } = await listLogEntries(loc, {
    log_type: "daily_narcotic_count",
    limit: 500,
    offset: 0,
  })

  const initialEntry = entry
    ? {
        id: entry.id,
        data: entry.data as unknown as DailyNarcoticCountLogData,
        status: entry.status,
        submitted_by_name: entry.submitted_by_name ?? null,
      }
    : null

  const isAdmin = profile.role === "admin" || profile.role === "owner"
  const availableMonthValues = allEntries
    .map((e) => e.log_key)
    .filter((v): v is string => /^\d{4}-\d{2}$/.test(v))
    .sort()
  const availableDateValues = Array.from(
    new Set(
      allEntries.flatMap((e) => {
        const parsed = dailyNarcoticCountLogDataSchema.safeParse(e.data)
        if (!parsed.success) return []
        return (parsed.data.entries ?? [])
          .map((row) => normalizeDncDateToIso(row.date))
          .filter((v): v is string => Boolean(v))
      })
    )
  ).sort()

  return (
    <NarcoticCountLog
      locationId={loc}
      year={year}
      month={month}
      initialEntry={initialEntry}
      isAdmin={isAdmin}
      availableMonthValues={availableMonthValues}
      availableDateValues={availableDateValues}
      instanceId={instanceId}
    />
  )
}

export default async function NarcoticCountPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; year?: string; month?: string; instanceId?: string }>
}) {
  const { loc, year: yearParam, month: monthParam, instanceId } = await searchParams
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
  const month = monthParam
    ? parseInt(monthParam, 10)
    : new Date().getMonth() + 1

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">
          Select a location to view the Daily Narcotic Count
        </p>
      </div>
    )
  }

  return (
    <Suspense
      key={`${loc}-${year}-${month}`}
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <NarcoticCountLoader loc={loc} year={year} month={month} instanceId={instanceId ?? null} />
    </Suspense>
  )
}
