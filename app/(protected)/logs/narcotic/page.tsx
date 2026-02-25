import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntryByDate, listLogEntries } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { NarcoticLog } from "./_components/narcotic-log"
import type { NarcoticLogData as NarcoticLogDataType } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Narcotic Log - Inspection Tracker",
}

async function NarcoticLogLoader({
  loc,
  date,
}: {
  loc: string
  date: string
}) {
  const { profile } = await requireLocationAccess(loc)

  const entry = await getLogEntryByDate(loc, "narcotic_log", date)
  const { entries: allEntries } = await listLogEntries(loc, {
    log_type: "narcotic_log",
    limit: 500,
    offset: 0,
  })

  const initialEntry = entry
    ? {
        id: entry.id,
        log_date: entry.log_date,
        data: entry.data as unknown as NarcoticLogDataType,
        status: entry.status,
        submitted_by_name: entry.submitted_by_name ?? null,
      }
    : null

  const isAdmin = profile.role === "admin" || profile.role === "owner"
  const availableDateValues = allEntries
    .map((e) => e.log_date)
    .filter((v): v is string => /^\d{4}-\d{2}-\d{2}$/.test(v))
    .sort()

  return (
    <NarcoticLog
      locationId={loc}
      initialDate={date}
      initialEntry={initialEntry}
      isAdmin={isAdmin}
      availableDateValues={availableDateValues}
    />
  )
}

export default async function NarcoticLogPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; date?: string }>
}) {
  const { loc, date } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view the Narcotic Log</p>
      </div>
    )
  }

  const logDate = date || new Date().toISOString().split("T")[0]

  return (
    <Suspense
      key={`${loc}-${logDate}`}
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <NarcoticLogLoader loc={loc} date={logDate} />
    </Suspense>
  )
}
