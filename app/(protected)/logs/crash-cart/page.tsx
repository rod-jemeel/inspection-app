import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntryByKey, listLogEntries } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { CrashCartLog } from "./_components/crash-cart-log"
import type { CrashCartLogData } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Crash Cart Monthly Checklist - Inspection Tracker",
}

async function CrashCartLoader({
  loc,
  year,
}: {
  loc: string
  year: number
}) {
  const { profile } = await requireLocationAccess(loc)

  const entry = await getLogEntryByKey(loc, "crash_cart_checklist", String(year))
  const { entries: allEntries } = await listLogEntries(loc, {
    log_type: "crash_cart_checklist",
    limit: 500,
    offset: 0,
  })

  const initialEntry = entry
    ? {
        id: entry.id,
        data: entry.data as unknown as CrashCartLogData,
        status: entry.status,
        submitted_by_name: entry.submitted_by_name ?? null,
      }
    : null

  const isAdmin = profile.role === "admin" || profile.role === "owner"
  const availableYearValues = allEntries
    .map((e) => Number.parseInt(e.log_key ?? "", 10))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b)

  return (
    <CrashCartLog
      locationId={loc}
      year={year}
      initialEntry={initialEntry}
      isAdmin={isAdmin}
      availableYearValues={availableYearValues}
    />
  )
}

export default async function CrashCartPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; year?: string }>
}) {
  const { loc, year: yearParam } = await searchParams
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view the Crash Cart Checklist</p>
      </div>
    )
  }

  return (
    <Suspense
      key={`${loc}-${year}`}
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <CrashCartLoader loc={loc} year={year} />
    </Suspense>
  )
}
