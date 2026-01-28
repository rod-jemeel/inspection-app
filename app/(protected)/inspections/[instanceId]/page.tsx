import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getInstance } from "@/lib/server/services/instances"
import { getTemplate } from "@/lib/server/services/templates"
import { listEvents } from "@/lib/server/services/events"
import { getSignatures } from "@/lib/server/services/signatures"
import { InspectionDetail } from "./_components/inspection-detail"

export const metadata: Metadata = {
  title: "Inspection Detail - Inspection Tracker",
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
    <InspectionDetail
      instance={instance}
      template={template}
      events={events}
      signatures={signatures}
      locationId={loc}
      profileId={profile.id}
    />
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
          <div className="mx-auto h-6 w-6 animate-spin rounded-none border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <InspectionDetailData instanceId={instanceId} loc={loc} />
    </Suspense>
  )
}
