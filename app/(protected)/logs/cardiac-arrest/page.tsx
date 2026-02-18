import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntry } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { CardiacArrestLog } from "./_components/cardiac-arrest-log"
import { CardiacArrestSummary } from "./_components/cardiac-arrest-summary"
import type { CardiacArrestRecordData } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Cardiac Arrest Record - Inspection Tracker",
}

/** Returns today as YYYY-MM */
function todayMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Form loader (existing or new record)
// ---------------------------------------------------------------------------

async function CardiacArrestLoader({
  loc,
  id,
  date,
  month,
}: {
  loc: string
  id?: string
  date: string
  month: string
}) {
  const { profile } = await requireLocationAccess(loc)
  const isAdmin = profile.role === "admin" || profile.role === "owner"

  let initialEntry: {
    id: string | null
    data: CardiacArrestRecordData
    status: "draft" | "complete"
    submitted_by_name: string | null
  } | null = null

  if (id) {
    const entry = await getLogEntry(loc, id)
    initialEntry = {
      id: entry.id,
      data: entry.data as unknown as CardiacArrestRecordData,
      status: entry.status,
      submitted_by_name: entry.submitted_by_name ?? null,
    }
  }

  return (
    <CardiacArrestLog
      locationId={loc}
      initialEntry={initialEntry}
      initialDate={date}
      backMonth={month}
      isAdmin={isAdmin}
    />
  )
}

// ---------------------------------------------------------------------------
// Summary loader (list view)
// ---------------------------------------------------------------------------

async function CardiacArrestSummaryLoader({
  loc,
  month,
}: {
  loc: string
  month: string
}) {
  await requireLocationAccess(loc)
  return <CardiacArrestSummary locationId={loc} currentMonth={month} />
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CardiacArrestPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; id?: string; date?: string; month?: string }>
}) {
  const { loc, id, date, month } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view Cardiac Arrest Records</p>
      </div>
    )
  }

  const currentMonth = month ?? todayMonth()

  // Form mode: a specific record (by id) or a new record (by date)
  if (id || date) {
    const logDate = date ?? new Date().toISOString().split("T")[0]
    return (
      <Suspense
        key={`form-${loc}-${id ?? "new"}-${logDate}`}
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center">
            <LoadingSpinner />
          </div>
        }
      >
        <CardiacArrestLoader loc={loc} id={id} date={logDate} month={currentMonth} />
      </Suspense>
    )
  }

  // Summary / list mode
  return (
    <Suspense
      key={`summary-${loc}-${currentMonth}`}
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <CardiacArrestSummaryLoader loc={loc} month={currentMonth} />
    </Suspense>
  )
}
