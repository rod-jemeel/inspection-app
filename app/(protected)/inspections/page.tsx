import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { listInstances } from "@/lib/server/services/instances"
import { InspectionList } from "./_components/inspection-list"

export const metadata: Metadata = {
  title: "Inspections - Inspection Tracker",
}

async function InspectionsData({ loc, status }: { loc: string; status?: string }) {
  await requireLocationAccess(loc)

  const filters = {
    status: status as any,
    limit: 50,
  }

  const instances = await listInstances(loc, filters)

  return <InspectionList instances={instances} locationId={loc} activeStatus={status} />
}

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; status?: string }>
}) {
  const { loc, status } = await searchParams
  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-xs">Select a location to view inspections</p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <InspectionsData loc={loc} status={status} />
    </Suspense>
  )
}
