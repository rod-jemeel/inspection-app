import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { supabase } from "@/lib/server/db"
import { DashboardContent } from "./_components/dashboard-content"

export const metadata: Metadata = {
  title: "Dashboard - Inspection Tracker",
}

async function DashboardData({ loc }: { loc: string }) {
  const { profile } = await requireLocationAccess(loc)

  const [
    { count: pendingCount },
    { count: overdueCount },
    { count: passedCount },
    { data: upcomingInstances },
  ] = await Promise.all([
    supabase
      .from("inspection_instances")
      .select("*", { count: "exact", head: true })
      .eq("location_id", loc)
      .in("status", ["pending", "in_progress"]),
    supabase
      .from("inspection_instances")
      .select("*", { count: "exact", head: true })
      .eq("location_id", loc)
      .in("status", ["pending", "in_progress"])
      .lt("due_at", new Date().toISOString()),
    supabase
      .from("inspection_instances")
      .select("*", { count: "exact", head: true })
      .eq("location_id", loc)
      .eq("status", "passed"),
    supabase
      .from("inspection_instances")
      .select("id, template_id, due_at, status, assigned_to_email, inspection_templates(task)")
      .eq("location_id", loc)
      .in("status", ["pending", "in_progress"])
      .order("due_at", { ascending: true })
      .limit(5),
  ])

  return (
    <DashboardContent
      stats={{
        pending: pendingCount ?? 0,
        overdue: overdueCount ?? 0,
        passed: passedCount ?? 0,
      }}
      upcomingInstances={(upcomingInstances ?? []).map((inst: any) => ({
        id: inst.id,
        task: inst.inspection_templates?.task ?? "Unknown",
        dueAt: inst.due_at,
        status: inst.status,
        assignee: inst.assigned_to_email,
      }))}
      locationId={loc}
    />
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-xs">Select a location to get started</p>
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
      <DashboardData loc={loc} />
    </Suspense>
  )
}
