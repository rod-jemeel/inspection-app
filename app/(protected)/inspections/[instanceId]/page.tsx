import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getInstance } from "@/lib/server/services/instances"
import { getTemplate } from "@/lib/server/services/templates"
import { listEvents } from "@/lib/server/services/events"
import { getSignatures } from "@/lib/server/services/signatures"
import { LoadingSpinner } from "@/components/loading-spinner"
import { PageBreadcrumbs } from "@/components/page-breadcrumbs"
import { InspectionDetail } from "./_components/inspection-detail"

export const metadata: Metadata = {
  title: "Inspection Detail",
}

async function InspectionDetailData({
  instanceId,
  loc,
}: {
  instanceId: string
  loc: string
}) {
  const { profile } = await requireLocationAccess(loc)
  const instance = await getInstance(loc, instanceId)

  const [template, events, signatures] = await Promise.all([
    getTemplate(loc, instance.template_id).catch(() => null),
    listEvents(instanceId),
    getSignatures(instanceId),
  ])

  return (
    <>
      <PageBreadcrumbs
        items={[
          { label: "Inspections", href: `/inspections?loc=${loc}` },
          { label: template?.task ?? "Inspection Detail" },
        ]}
      />
      <InspectionDetail
        instance={instance}
        template={template}
        events={events}
        signatures={signatures}
        locationId={loc}
        profileId={profile.id}
      />
    </>
  )
}

export default async function InspectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ instanceId: string }>
  searchParams: Promise<{ loc?: string }>
}) {
  const { instanceId } = await params
  const { loc } = await searchParams

  if (!loc) {
    return (
      <div className="py-20 text-center text-xs text-muted-foreground">
        Select a location
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
      <InspectionDetailData instanceId={instanceId} loc={loc} />
    </Suspense>
  )
}
