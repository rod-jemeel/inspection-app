import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSession, getProfile } from "@/lib/server/auth-helpers"
import { supabase } from "@/lib/server/db"
import { getBindersForUser } from "@/lib/server/services/binders"
import { LoadingSpinner } from "@/components/loading-spinner"
import { AppShell } from "./_components/app-shell"

interface ProfileLocationRow {
  locations: { id: string; name: string } | null
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null)
  if (!session) redirect("/login")

  const profile = await getProfile(session.user.id).catch(() => null)
  if (!profile) redirect("/login")

  const { data: profileLocations } = await supabase
    .from("profile_locations")
    .select("location_id, locations(id, name)")
    .eq("profile_id", profile.id)

  const locations = (profileLocations as ProfileLocationRow[] | null ?? [])
    .filter((pl) => pl.locations)
    .map((pl) => ({
      id: pl.locations!.id,
      name: pl.locations!.name,
    }))

  // Fetch binders for sidebar navigation
  let binders: { id: string; name: string; color: string | null; icon: string | null }[] = []
  let pendingCount = 0
  if (locations.length > 0) {
    try {
      const allBinders = await getBindersForUser(locations[0].id, profile.id, profile.role, {
        can_manage_binders: profile.can_manage_binders,
        can_manage_forms: profile.can_manage_forms,
      })
      binders = allBinders.map((b) => ({
        id: b.id,
        name: b.name,
        color: b.color,
        icon: b.icon,
      }))
    } catch (err) {
      // Binders are optional for sidebar — don't block render, but log in dev
      if (process.env.NODE_ENV !== "production") {
        console.warn("[layout] Failed to load sidebar binders:", err)
      }
    }

    // Fetch pending inspection count for sidebar badge
    try {
      const isNonAdmin = !["owner", "admin"].includes(profile.role)
      let query = supabase
        .from("inspection_instances")
        .select("*", { count: "exact", head: true })
        .eq("location_id", locations[0].id)
        .in("status", ["pending", "in_progress"])
      if (isNonAdmin && profile.email) {
        query = query.eq("assigned_to_email", profile.email)
      }
      const { count } = await query
      pendingCount = count ?? 0
    } catch {
      // Non-critical — sidebar badge is a nice-to-have
    }
  }

  return (
    <AppShell
      user={{ name: profile.full_name, email: profile.email, role: profile.role }}
      locations={locations}
      binders={binders}
      pendingCount={pendingCount}
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
