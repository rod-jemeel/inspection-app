import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntryByDate } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { NarcoticSignoutLog } from "./_components/narcotic-signout-log"
import type { NarcoticSignoutLogData as NarcoticSignoutLogDataType } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Narcotic Sign-out - Inspection Tracker",
}

async function NarcoticSignoutLoader({
  loc,
  date,
}: {
  loc: string
  date: string
}) {
  const { profile } = await requireLocationAccess(loc)

  const entry = await getLogEntryByDate(loc, "narcotic_signout", date)

  const initialEntry = entry
    ? {
        id: entry.id,
        log_date: entry.log_date,
        data: entry.data as unknown as NarcoticSignoutLogDataType,
        status: entry.status,
        submitted_by_name: entry.submitted_by_name ?? null,
      }
    : null

  const isAdmin = profile.role === "admin" || profile.role === "owner"

  return (
    <NarcoticSignoutLog
      locationId={loc}
      initialDate={date}
      initialEntry={initialEntry}
      isAdmin={isAdmin}
    />
  )
}

export default async function NarcoticSignoutPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; date?: string }>
}) {
  const { loc, date } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view the Narcotic Sign-out Form</p>
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
      <NarcoticSignoutLoader loc={loc} date={logDate} />
    </Suspense>
  )
}
