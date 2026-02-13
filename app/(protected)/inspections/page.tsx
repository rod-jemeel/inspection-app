import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { listInstances } from "@/lib/server/services/instances"
import { listBinders } from "@/lib/server/services/binders"
import { LoadingSpinner } from "@/components/loading-spinner"
import { InspectionList } from "./_components/inspection-list"
import { InspectionModal } from "./_components/inspection-modal"

export const metadata: Metadata = {
  title: "Inspections - Inspection Tracker",
}

async function InspectionsData({ loc, status, binder }: { loc: string; status?: string; binder?: string }) {
  const { profile } = await requireLocationAccess(loc)

  const filters: any = {
    status: status as any,
    limit: 50,
  }
  if (binder) filters.binder_id = binder

  const instances = await listInstances(loc, filters)

  // Fetch binders for filter dropdown
  let binderOptions: { id: string; name: string }[] = []
  try {
    const binders = await listBinders(loc)
    binderOptions = binders.map((b: any) => ({ id: b.id, name: b.name }))
  } catch {
    // Ignore
  }

  return (
    <>
      <InspectionList
        instances={instances}
        locationId={loc}
        activeStatus={status}
        binders={binderOptions}
        activeBinder={binder}
      />
      <InspectionModal locationId={loc} profileId={profile.id} instances={instances} />
    </>
  )
}

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; status?: string; binder?: string }>
}) {
  const { loc, status, binder } = await searchParams
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
          <LoadingSpinner />
        </div>
      }
    >
      <InspectionsData loc={loc} status={status} binder={binder} />
    </Suspense>
  )
}
