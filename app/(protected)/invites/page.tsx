import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { listInviteCodes } from "@/lib/server/services/invite-codes"
import { LoadingSpinner } from "@/components/loading-spinner"
import { InviteManagement } from "./_components/invite-management"

export const metadata: Metadata = {
  title: "Invites - Inspection Tracker",
}

async function InvitesData({ loc }: { loc: string }) {
  await requireLocationAccess(loc, ["admin", "owner"])
  const invites = await listInviteCodes(loc)

  return <InviteManagement invites={invites} locationId={loc} />
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams
  if (!loc) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Select a location to manage invites
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
      <InvitesData loc={loc} />
    </Suspense>
  )
}
