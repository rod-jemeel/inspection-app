import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntryByKey, listLogEntries } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { CrashCartDailyLog } from "./_components/crash-cart-daily-log"
import type { CrashCartDailyLogData } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Crash Cart Daily Checklist",
}

async function CrashCartDailyLoader({
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
  const entry = await getLogEntryByKey(loc, "crash_cart_daily", logKey)
  const { entries: allDailyEntries } = await listLogEntries(loc, {
    log_type: "crash_cart_daily",
    limit: 500,
    offset: 0,
  })

  const initialEntry = entry
    ? {
        id: entry.id,
        data: entry.data as unknown as CrashCartDailyLogData,
        status: entry.status,
        submitted_by_name: entry.submitted_by_name ?? null,
      }
    : null

  const isAdmin = profile.role === "admin" || profile.role === "owner"

  const monthKeys = allDailyEntries
    .map((e) => e.log_key)
    .filter((k): k is string => /^\d{4}-\d{2}$/.test(k))
    .sort()

  const availableMonthRange = monthKeys.length > 0
    ? { from: monthKeys[0], to: monthKeys[monthKeys.length - 1] }
    : undefined

  return (
    <CrashCartDailyLog
      locationId={loc}
      year={year}
      month={month}
      initialEntry={initialEntry}
      isAdmin={isAdmin}
      availableMonthRange={availableMonthRange}
      availableMonthValues={monthKeys}
      instanceId={instanceId}
    />
  )
}

export default async function CrashCartDailyPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; year?: string; month?: string; instanceId?: string }>
}) {
  const { loc, year: yearParam, month: monthParam, instanceId } = await searchParams
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
      <CrashCartDailyLoader loc={loc} year={year} month={month} instanceId={instanceId ?? null} />
    </Suspense>
  )
}
