import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getTeamMembers } from "@/lib/server/services/locations"
import { listInviteCodes } from "@/lib/server/services/invite-codes"
import { UsersContent } from "./_components/users-content"

export const metadata: Metadata = {
  title: "Team - Inspection Tracker",
}

async function UsersData({ loc }: { loc: string }) {
  const { profile } = await requireLocationAccess(loc)
  const canEdit = profile.role === "admin" || profile.role === "owner"

  const [teamMembers, invites] = await Promise.all([
    getTeamMembers(loc),
    canEdit ? listInviteCodes(loc) : Promise.resolve([]),
  ])

  return (
    <UsersContent
      locationId={loc}
      teamMembers={teamMembers}
      invites={invites}
      currentProfileId={profile.id}
      canEdit={canEdit}
    />
  )
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams
  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view team members</p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-md border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <UsersData loc={loc} />
    </Suspense>
  )
}
