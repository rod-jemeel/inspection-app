import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireLocationAccess, getSession, getProfile } from "@/lib/server/auth-helpers"
import { supabase } from "@/lib/server/db"
import { LoadingSpinner } from "@/components/loading-spinner"
import { DashboardContent } from "./_components/dashboard-content"

export const metadata: Metadata = {
  title: "Dashboard - Inspection Tracker",
}

// Type for inspection instance with template relation
interface InspectionInstanceRow {
  id: string
  due_at: string
  status: "pending" | "in_progress" | "failed" | "passed" | "void"
  assigned_to_email: string | null
  inspection_templates: {
    task: string
    frequency: string | null
  } | null
}

// Type for weekly trend data
interface WeeklyTrend {
  week: string
  weekLabel: string
  completed: number
  failed: number
  pending: number
}

// Type for monthly compliance data
interface MonthlyCompliance {
  month: string
  monthLabel: string
  complianceRate: number
  completed: number
  total: number
}

// Type for recent inspection (for export)
interface RecentInspection {
  id: string
  task: string
  dueAt: string
  status: string
  assignee: string | null
  completedAt: string | null
}

// Supabase may return single relation as object or array, handle both
function normalizeInstance(inst: Record<string, unknown>): InspectionInstanceRow {
  const template = inst.inspection_templates
  const normalizedTemplate = Array.isArray(template)
    ? template[0] ?? null
    : template ?? null

  return {
    id: inst.id as string,
    due_at: inst.due_at as string,
    status: inst.status as InspectionInstanceRow["status"],
    assigned_to_email: inst.assigned_to_email as string | null,
    inspection_templates: normalizedTemplate as InspectionInstanceRow["inspection_templates"],
  }
}

// Get week start date for a given date (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Format week label (e.g., "Jan 20")
function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

async function DashboardData({ loc }: { loc: string }) {
  // Get profile for role-based filtering
  const { profile } = await requireLocationAccess(loc)
  const isInspector = profile.role === "inspector" || profile.role === "nurse"

  // Fetch location name
  const { data: locationData } = await supabase
    .from("locations")
    .select("name")
    .eq("id", loc)
    .single()
  const locationName = locationData?.name ?? null

  // Get date ranges
  const now = new Date()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthsAhead = new Date(now)
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3)

  const weekFromNow = new Date(now)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // For weekly trends (last 4 weeks)
  const fourWeeksAgo = new Date(now)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  // For monthly compliance (last 6 months)
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // Build base queries - for inspectors, filter by their email
  const inspectorFilter = isInspector && profile.email
    ? { column: "assigned_to_email", value: profile.email }
    : null

  // Helper to add inspector filter to query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addInspectorFilter = (query: any) => {
    if (inspectorFilter) {
      return query.eq(inspectorFilter.column, inspectorFilter.value)
    }
    return query
  }

  const [
    { count: pendingCount },
    { count: overdueCount },
    { count: passedCount },
    { count: failedCount },
    { count: dueThisWeekCount },
    { count: completedLast30Days },
    { count: totalDueLast30Days },
    { data: calendarInstances },
    { data: overdueInstances },
    { data: trendInstances },
    { data: statusBreakdown },
    { data: monthlyInstances },
    { data: recentInspections },
  ] = await Promise.all([
    // Pending inspections
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("*", { count: "exact", head: true })
        .eq("location_id", loc)
        .in("status", ["pending", "in_progress"])
    ),
    // Overdue inspections
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("*", { count: "exact", head: true })
        .eq("location_id", loc)
        .in("status", ["pending", "in_progress"])
        .lt("due_at", now.toISOString())
    ),
    // Passed inspections (all time)
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("*", { count: "exact", head: true })
        .eq("location_id", loc)
        .eq("status", "passed")
    ),
    // Failed inspections
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("*", { count: "exact", head: true })
        .eq("location_id", loc)
        .eq("status", "failed")
    ),
    // Due this week
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("*", { count: "exact", head: true })
        .eq("location_id", loc)
        .in("status", ["pending", "in_progress"])
        .gte("due_at", now.toISOString())
        .lte("due_at", weekFromNow.toISOString())
    ),
    // Completed in last 30 days
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("*", { count: "exact", head: true })
        .eq("location_id", loc)
        .eq("status", "passed")
        .gte("passed_at", thirtyDaysAgo.toISOString())
    ),
    // Total due in last 30 days
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("*", { count: "exact", head: true })
        .eq("location_id", loc)
        .neq("status", "void")
        .gte("due_at", thirtyDaysAgo.toISOString())
        .lte("due_at", now.toISOString())
    ),
    // Calendar events (limited to prevent unbounded queries)
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("id, due_at, status, assigned_to_email, inspection_templates(task, frequency)")
        .eq("location_id", loc)
        .gte("due_at", threeMonthsAgo.toISOString())
        .lte("due_at", threeMonthsAhead.toISOString())
        .neq("status", "void")
        .order("due_at", { ascending: true })
        .limit(500)
    ),
    // Overdue alerts (limit to 5 most urgent)
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("id, due_at, status, assigned_to_email, inspection_templates(task, frequency)")
        .eq("location_id", loc)
        .in("status", ["pending", "in_progress"])
        .lt("due_at", now.toISOString())
        .order("due_at", { ascending: true })
        .limit(5)
    ),
    // Trend data (last 4 weeks) - for charts
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("id, due_at, status, passed_at")
        .eq("location_id", loc)
        .neq("status", "void")
        .gte("due_at", fourWeeksAgo.toISOString())
        .lte("due_at", now.toISOString())
    ),
    // Status breakdown for pie chart (all non-void)
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("status")
        .eq("location_id", loc)
        .neq("status", "void")
    ),
    // Monthly compliance data (last 6 months) - for line chart
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("id, due_at, status, passed_at")
        .eq("location_id", loc)
        .neq("status", "void")
        .gte("due_at", sixMonthsAgo.toISOString())
        .lte("due_at", now.toISOString())
    ),
    // Recent inspections (last 50) - for export
    addInspectorFilter(
      supabase
        .from("inspection_instances")
        .select("id, due_at, status, passed_at, assigned_to_email, inspection_templates(task)")
        .eq("location_id", loc)
        .neq("status", "void")
        .order("due_at", { ascending: false })
        .limit(50)
    ),
  ])

  // Calculate compliance rate
  const completed = completedLast30Days ?? 0
  const totalDue = totalDueLast30Days ?? 0
  const complianceRate = totalDue > 0 ? Math.round((completed / totalDue) * 100) : 100

  // Process weekly trend data
  const weeklyTrends: WeeklyTrend[] = []
  const weekMap = new Map<string, { completed: number; failed: number; pending: number }>()

  // Initialize last 4 weeks
  for (let i = 3; i >= 0; i--) {
    const weekStart = getWeekStart(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000))
    const weekKey = weekStart.toISOString().split("T")[0]
    weekMap.set(weekKey, { completed: 0, failed: 0, pending: 0 })
  }

  // Aggregate trend instances by week
  for (const inst of trendInstances ?? []) {
    const dueDate = new Date(inst.due_at)
    const weekStart = getWeekStart(dueDate)
    const weekKey = weekStart.toISOString().split("T")[0]

    const weekData = weekMap.get(weekKey)
    if (weekData) {
      if (inst.status === "passed") {
        weekData.completed++
      } else if (inst.status === "failed") {
        weekData.failed++
      } else if (inst.status === "pending" || inst.status === "in_progress") {
        weekData.pending++
      }
    }
  }

  // Convert to array
  for (const [weekKey, data] of weekMap) {
    const weekDate = new Date(weekKey)
    weeklyTrends.push({
      week: weekKey,
      weekLabel: formatWeekLabel(weekDate),
      ...data,
    })
  }

  // Process status breakdown for pie chart
  const statusCounts = { passed: 0, failed: 0, pending: 0, in_progress: 0 }
  for (const inst of statusBreakdown ?? []) {
    const status = inst.status as keyof typeof statusCounts
    if (status in statusCounts) {
      statusCounts[status]++
    }
  }

  // Process monthly compliance data for line chart
  const monthlyCompliance: MonthlyCompliance[] = []
  const monthMap = new Map<string, { completed: number; total: number }>()

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`
    monthMap.set(monthKey, { completed: 0, total: 0 })
  }

  // Aggregate monthly instances
  for (const inst of monthlyInstances ?? []) {
    const dueDate = new Date(inst.due_at)
    const monthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`

    const monthData = monthMap.get(monthKey)
    if (monthData) {
      monthData.total++
      if (inst.status === "passed") {
        monthData.completed++
      }
    }
  }

  // Convert to array with compliance rate
  for (const [monthKey, data] of monthMap) {
    const [year, month] = monthKey.split("-")
    const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    monthlyCompliance.push({
      month: monthKey,
      monthLabel: monthDate.toLocaleDateString("en-US", { month: "short" }),
      complianceRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      completed: data.completed,
      total: data.total,
    })
  }

  // Process recent inspections for export
  const recentInspectionsList: RecentInspection[] = ((recentInspections ?? []) as Record<string, unknown>[]).map((row) => {
    const template = row.inspection_templates
    const normalizedTemplate = Array.isArray(template) ? template[0] : template
    return {
      id: row.id as string,
      task: (normalizedTemplate as { task?: string } | null)?.task ?? "Inspection",
      dueAt: row.due_at as string,
      status: row.status as string,
      assignee: row.assigned_to_email as string | null,
      completedAt: row.passed_at as string | null,
    }
  })

  return (
    <DashboardContent
      stats={{
        pending: pendingCount ?? 0,
        overdue: overdueCount ?? 0,
        passed: passedCount ?? 0,
        failed: failedCount ?? 0,
        dueThisWeek: dueThisWeekCount ?? 0,
        complianceRate,
      }}
      calendarEvents={((calendarInstances ?? []) as Record<string, unknown>[]).map((row) => {
        const inst = normalizeInstance(row)
        return {
          id: inst.id,
          task: inst.inspection_templates?.task ?? "Inspection",
          dueAt: inst.due_at,
          status: inst.status,
          assignee: inst.assigned_to_email,
          frequency: inst.inspection_templates?.frequency ?? null,
        }
      })}
      overdueAlerts={((overdueInstances ?? []) as Record<string, unknown>[]).map((row) => {
        const inst = normalizeInstance(row)
        return {
          id: inst.id,
          task: inst.inspection_templates?.task ?? "Inspection",
          dueAt: inst.due_at,
          assignee: inst.assigned_to_email,
          frequency: inst.inspection_templates?.frequency ?? null,
          daysOverdue: Math.floor((now.getTime() - new Date(inst.due_at).getTime()) / (1000 * 60 * 60 * 24)),
        }
      })}
      weeklyTrends={weeklyTrends}
      statusBreakdown={statusCounts}
      monthlyCompliance={monthlyCompliance}
      recentInspections={recentInspectionsList}
      locationId={loc}
      locationName={locationName}
      userRole={profile.role}
      userName={profile.full_name}
    />
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams

  // If no location specified, redirect to first available location
  if (!loc) {
    const session = await getSession().catch(() => null)
    if (session) {
      const profile = await getProfile(session.user.id).catch(() => null)
      if (profile) {
        const { data: profileLocations } = await supabase
          .from("profile_locations")
          .select("location_id")
          .eq("profile_id", profile.id)
          .limit(1)
          .single()

        if (profileLocations?.location_id) {
          redirect(`/dashboard?loc=${profileLocations.location_id}`)
        }
      }
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-xs">No locations available. Please contact an administrator.</p>
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
      <DashboardData loc={loc} />
    </Suspense>
  )
}
