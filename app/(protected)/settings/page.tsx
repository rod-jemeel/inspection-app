import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLocation } from "@/lib/server/services/locations"
import { SettingsContent } from "./_components/settings-content"

export const metadata: Metadata = {
  title: "Settings - Inspection Tracker",
}

async function SettingsData({ loc }: { loc: string }) {
  const { profile } = await requireLocationAccess(loc)
  const canEdit = profile.role === "admin" || profile.role === "owner"
  const isOwner = profile.role === "owner"

  const location = await getLocation(loc)

  return (
    <SettingsContent
      location={location}
      canEdit={canEdit}
      isOwner={isOwner}
    />
  )
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams
  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view settings</p>
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
      <SettingsData loc={loc} />
    </Suspense>
  )
}
