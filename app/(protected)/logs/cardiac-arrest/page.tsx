import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntry } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { CardiacArrestLog } from "./_components/cardiac-arrest-log"
import type { CardiacArrestRecordData } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Cardiac Arrest Record - Inspection Tracker",
}

async function CardiacArrestLoader({
  loc,
  id,
  date,
}: {
  loc: string
  id?: string
  date: string
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
      isAdmin={isAdmin}
    />
  )
}

export default async function CardiacArrestPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; id?: string; date?: string }>
}) {
  const { loc, id, date } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to create a Cardiac Arrest Record</p>
      </div>
    )
  }

  const logDate = date || new Date().toISOString().split("T")[0]

  return (
    <Suspense
      key={`${loc}-${id ?? "new"}-${logDate}`}
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <CardiacArrestLoader loc={loc} id={id} date={logDate} />
    </Suspense>
  )
}
