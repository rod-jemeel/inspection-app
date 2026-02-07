import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getBindersForUser } from "@/lib/server/services/binders"
import { BinderList } from "./_components/binder-list"

export const metadata: Metadata = {
  title: "Binders - Inspection Tracker",
}

async function BindersData({ loc }: { loc: string }) {
  const { profile } = await requireLocationAccess(loc)
  const binders = await getBindersForUser(loc, profile.id, profile.role)
  const canManage = profile.role === "owner" || profile.role === "admin" || profile.can_manage_binders

  return (
    <BinderList
      binders={binders}
      locationId={loc}
      canManage={canManage}
      profileId={profile.id}
    />
  )
}

export default async function BindersPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams
  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view binders</p>
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
      <BindersData loc={loc} />
    </Suspense>
  )
}
