import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntryByKey } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { CrashCartDailyLog } from "./_components/crash-cart-daily-log"
import type { CrashCartDailyLogData } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Crash Cart Daily Checklist - Inspection Tracker",
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

async function CrashCartDailyLoader({
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
  const entry = await getLogEntryByKey(loc, "crash_cart_daily", logKey)

  const initialEntry = entry
    ? {
        id: entry.id,
        data: entry.data as unknown as CrashCartDailyLogData,
        status: entry.status,
        submitted_by_name: entry.submitted_by_name ?? null,
      }
    : null

  const isAdmin = profile.role === "admin" || profile.role === "owner"

  return (
    <CrashCartDailyLog
      locationId={loc}
      year={year}
      month={month}
      initialEntry={initialEntry}
      isAdmin={isAdmin}
    />
  )
}

export default async function CrashCartDailyPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; year?: string; month?: string }>
}) {
  const { loc, year: yearParam, month: monthParam } = await searchParams
  const now = new Date()
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear()
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view the Crash Cart Daily Checklist</p>
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
      <CrashCartDailyLoader loc={loc} year={year} month={month} />
    </Suspense>
  )
}
