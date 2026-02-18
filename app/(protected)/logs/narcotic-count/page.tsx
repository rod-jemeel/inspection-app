import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntryByKey } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { NarcoticCountLog } from "./_components/narcotic-count-log"
import type { DailyNarcoticCountLogData } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Daily Narcotic Count - Inspection Tracker",
}

async function NarcoticCountLoader({
  loc,
  year,
  month,
}: {
  loc: string
  year: number
  month: number
}) {
  const { profile } = await requireLocationAccess(loc)

  const logKey = `${year}-${String(month).padStart(2, "0")}`
  const entry = await getLogEntryByKey(loc, "daily_narcotic_count", logKey)

  const initialEntry = entry
    ? {
        id: entry.id,
        data: entry.data as unknown as DailyNarcoticCountLogData,
        status: entry.status,
        submitted_by_name: entry.submitted_by_name ?? null,
      }
    : null

  const isAdmin = profile.role === "admin" || profile.role === "owner"

  return (
    <NarcoticCountLog
      locationId={loc}
      year={year}
      month={month}
      initialEntry={initialEntry}
      isAdmin={isAdmin}
    />
  )
}

export default async function NarcoticCountPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; year?: string; month?: string }>
}) {
  const { loc, year: yearParam, month: monthParam } = await searchParams
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
      <NarcoticCountLoader loc={loc} year={year} month={month} />
    </Suspense>
  )
}
