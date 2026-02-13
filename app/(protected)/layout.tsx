import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSession, getProfile } from "@/lib/server/auth-helpers"
import { supabase } from "@/lib/server/db"
import { listBinders } from "@/lib/server/services/binders"
import { LoadingSpinner } from "@/components/loading-spinner"
import { AppShell } from "./_components/app-shell"

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null)
  if (!session) redirect("/login")

  const profile = await getProfile(session.user.id).catch(() => null)
  if (!profile) redirect("/login")

  const { data: profileLocations } = await supabase
    .from("profile_locations")
    .select("location_id, locations(id, name)")
    .eq("profile_id", profile.id)

  const locations = (profileLocations ?? []).map((pl: any) => ({
    id: pl.locations.id as string,
    name: pl.locations.name as string,
  }))

  // Fetch binders for sidebar navigation
  let binders: { id: string; name: string; color: string | null }[] = []
  if (locations.length > 0) {
    try {
      const allBinders = await listBinders(locations[0].id)
      binders = allBinders.map((b: any) => ({ id: b.id, name: b.name, color: b.color }))
    } catch {
      // Ignore - binders are optional for sidebar
    }
  }

  return (
    <AppShell
      user={{ name: profile.full_name, email: profile.email, role: profile.role }}
      locations={locations}
      binders={binders}
      mustChangePassword={profile.must_change_password}
    >
      {children}
    </AppShell>
  )
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-background">
          <div className="space-y-3 text-center">
            <LoadingSpinner />
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  )
}
