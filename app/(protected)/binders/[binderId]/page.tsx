import type { Metadata } from "next"
import { Suspense } from "react"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getBinder, canUserEditBinder } from "@/lib/server/services/binders"
import { listFormTemplates } from "@/lib/server/services/form-templates"
import { BinderDetail } from "./_components/binder-detail"

export const metadata: Metadata = { title: "Binder - Inspection Tracker" }

async function BinderData({ loc, binderId }: { loc: string; binderId: string }) {
  const { profile } = await requireLocationAccess(loc)
  const binder = await getBinder(loc, binderId)
  const templates = await listFormTemplates(loc, binderId, { active: true })
  const canEdit = await canUserEditBinder(profile.id, binderId, profile.role)

  return (
    <BinderDetail
      binder={binder}
      templates={templates}
      locationId={loc}
      canEdit={canEdit}
      profileId={profile.id}
    />
  )
}

export default async function BinderPage({
  params,
  searchParams,
}: {
  params: Promise<{ binderId: string }>
  searchParams: Promise<{ loc?: string }>
}) {
  const { binderId } = await params
  const { loc } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view this binder</p>
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
      <BinderData loc={loc} binderId={binderId} />
    </Suspense>
  )
}
