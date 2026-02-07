"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { AlertTriangle, CheckCircle, Clock, CalendarDays, XCircle, TrendingUp, ChevronRight, Send, BarChart3, User, Download, FileText } from "lucide-react"
import type { Role } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts"

// Dynamically import calendar to avoid SSR issues with temporal-polyfill
const InspectionCalendar = dynamic(
  () => import("./inspection-calendar").then((mod) => mod.InspectionCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border bg-muted/20">
        <Skeleton className="h-full w-full" />
      </div>
    ),
  }
)

interface CalendarEvent {
  id: string
  task: string
  dueAt: string
  status: "pending" | "in_progress" | "failed" | "passed" | "void"
  assignee: string | null
  frequency: string | null
}

interface OverdueAlert {
  id: string
  task: string
  dueAt: string
  assignee: string | null
  frequency: string | null
  daysOverdue: number
}

interface WeeklyTrend {
  week: string
  weekLabel: string
  completed: number
  failed: number
  pending: number
}

interface MonthlyCompliance {
  month: string
  monthLabel: string
  complianceRate: number
  completed: number
  total: number
}

interface RecentInspection {
  id: string
  task: string
  dueAt: string
  status: string
  assignee: string | null
  completedAt: string | null
}

interface DashboardContentProps {
  stats: {
    pending: number
    overdue: number
    passed: number
    failed: number
    dueThisWeek: number
    complianceRate: number
  }
  calendarEvents: CalendarEvent[]
  overdueAlerts: OverdueAlert[]
  weeklyTrends: WeeklyTrend[]
  statusBreakdown: {
    passed: number
    failed: number
    pending: number
    in_progress: number
  }
  monthlyCompliance: MonthlyCompliance[]
  recentInspections: RecentInspection[]
  locationId: string
  locationName?: string | null
  userRole: Role
  userName: string
}

// Chart colors
const COLORS = {
  completed: "oklch(0.55 0.18 145)", // Green
  failed: "oklch(0.58 0.22 27)", // Red
  pending: "oklch(0.65 0.15 264)", // Blue/purple
  in_progress: "oklch(0.7 0.15 85)", // Amber
  compliance: "oklch(0.55 0.2 264)", // Primary purple
}

const PIE_COLORS = [COLORS.completed, COLORS.failed, COLORS.pending, COLORS.in_progress]

function getUrgencyColor(daysOverdue: number) {
  if (daysOverdue >= 14) return "bg-destructive/10 text-destructive border-destructive/20"
  if (daysOverdue >= 7) return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400"
  return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
}

function getUrgencyBadge(daysOverdue: number) {
  if (daysOverdue >= 14) return { label: "Critical", variant: "destructive" as const }
  if (daysOverdue >= 7) return { label: "High", variant: "secondary" as const }
  return { label: "Medium", variant: "outline" as const }
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: "Owner",
    admin: "Administrator",
    nurse: "Staff",
    inspector: "Inspector",
  }
  return labels[role] || role
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// CSV Export function
function exportToCSV(inspections: RecentInspection[], filename: string) {
  const headers = ["Task", "Due Date", "Status", "Assignee", "Completed Date"]
  const rows = inspections.map((i) => [
    i.task,
    formatDate(i.dueAt),
    formatStatus(i.status),
    i.assignee || "Unassigned",
    i.completedAt ? formatDate(i.completedAt) : "-",
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}

// PDF Export function (using jspdf)
async function exportToPDF(
  inspections: RecentInspection[],
  stats: DashboardContentProps["stats"],
  filename: string
) {
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(18)
  doc.text("Inspection Report", pageWidth / 2, 20, { align: "center" })

  // Date
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 28, { align: "center" })

  // Summary stats
  doc.setFontSize(12)
  doc.text("Summary", 14, 40)

  doc.setFontSize(10)
  doc.text(`Pending: ${stats.pending}`, 14, 50)
  doc.text(`Overdue: ${stats.overdue}`, 60, 50)
  doc.text(`Passed: ${stats.passed}`, 106, 50)
  doc.text(`Failed: ${stats.failed}`, 14, 58)
  doc.text(`Due This Week: ${stats.dueThisWeek}`, 60, 58)
  doc.text(`Compliance Rate: ${stats.complianceRate}%`, 106, 58)

  // Table
  const tableData = inspections.map((i) => [
    i.task,
    formatDate(i.dueAt),
    formatStatus(i.status),
    i.assignee || "Unassigned",
    i.completedAt ? formatDate(i.completedAt) : "-",
  ])

  autoTable(doc, {
    head: [["Task", "Due Date", "Status", "Assignee", "Completed"]],
    body: tableData,
    startY: 70,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [100, 100, 200] },
  })

  doc.save(filename)
}

export function DashboardContent({
  stats,
  calendarEvents,
  overdueAlerts,
  weeklyTrends,
  statusBreakdown,
  monthlyCompliance,
  recentInspections,
  locationId,
  locationName,
  userRole,
  userName,
}: DashboardContentProps) {
  const isInspector = userRole === "inspector" || userRole === "nurse"
  const canExport = userRole === "owner" || userRole === "admin"

  // Prepare pie chart data
  const pieData = [
    { name: "Passed", value: statusBreakdown.passed, color: COLORS.completed },
    { name: "Failed", value: statusBreakdown.failed, color: COLORS.failed },
    { name: "Pending", value: statusBreakdown.pending, color: COLORS.pending },
    { name: "In Progress", value: statusBreakdown.in_progress, color: COLORS.in_progress },
  ].filter((d) => d.value > 0)

  const totalInspections = pieData.reduce((sum, d) => sum + d.value, 0)

  const handleExportCSV = () => {
    const date = new Date().toISOString().split("T")[0]
    exportToCSV(recentInspections, `inspections-${date}.csv`)
  }

  const handleExportPDF = () => {
    const date = new Date().toISOString().split("T")[0]
    exportToPDF(recentInspections, stats, `inspection-report-${date}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Role-based header with export buttons */}
      <div className="rounded-lg border bg-card p-3 sm:p-4">
        {/* Mobile: stacked layout, Desktop: horizontal layout */}
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:size-10">
            <User className="size-4 text-primary sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium sm:text-sm">
                {isInspector ? `Welcome back, ${userName}` : `Dashboard Overview`}
              </span>
              <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                {getRoleLabel(userRole)}
              </Badge>
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
              {isInspector
                ? "Showing your assigned inspections"
                : `Viewing all location inspections`}
            </div>
            {/* Mobile: export buttons below text */}
            <div className="mt-2 flex items-center gap-2 sm:hidden">
              {canExport && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={handleExportCSV}
                  >
                    <Download className="size-3" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={handleExportPDF}
                  >
                    <FileText className="size-3" />
                    PDF
                  </Button>
                </>
              )}
              <Badge variant="outline" className="text-[9px]">
                {getRoleLabel(userRole)}
              </Badge>
            </div>
          </div>
          {/* Desktop: export buttons on the right */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {canExport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleExportCSV}
                >
                  <Download className="size-3.5" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleExportPDF}
                >
                  <FileText className="size-3.5" />
                  PDF
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats - 2x3 grid on mobile, 6x1 on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Pending */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-muted">
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-xl font-semibold tabular-nums">{stats.pending}</div>
            <div className="text-[11px] text-muted-foreground">Pending</div>
          </div>
        </div>

        {/* Overdue */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className={cn(
            "flex size-9 items-center justify-center rounded-md",
            stats.overdue > 0 ? "bg-destructive/10" : "bg-muted"
          )}>
            <AlertTriangle className={cn(
              "size-4",
              stats.overdue > 0 ? "text-destructive" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <div className={cn(
              "text-xl font-semibold tabular-nums",
              stats.overdue > 0 && "text-destructive"
            )}>
              {stats.overdue}
            </div>
            <div className="text-[11px] text-muted-foreground">Overdue</div>
          </div>
        </div>

        {/* Due This Week */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className={cn(
            "flex size-9 items-center justify-center rounded-md",
            stats.dueThisWeek > 0 ? "bg-amber-100 dark:bg-amber-900/20" : "bg-muted"
          )}>
            <CalendarDays className={cn(
              "size-4",
              stats.dueThisWeek > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <div className={cn(
              "text-xl font-semibold tabular-nums",
              stats.dueThisWeek > 0 && "text-amber-600 dark:text-amber-400"
            )}>
              {stats.dueThisWeek}
            </div>
            <div className="text-[11px] text-muted-foreground">Due This Week</div>
          </div>
        </div>

        {/* Passed */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/10">
            <CheckCircle className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-xl font-semibold tabular-nums">{stats.passed}</div>
            <div className="text-[11px] text-muted-foreground">Passed</div>
          </div>
        </div>

        {/* Failed */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className={cn(
            "flex size-9 items-center justify-center rounded-md",
            stats.failed > 0 ? "bg-destructive/10" : "bg-muted"
          )}>
            <XCircle className={cn(
              "size-4",
              stats.failed > 0 ? "text-destructive" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <div className={cn(
              "text-xl font-semibold tabular-nums",
              stats.failed > 0 && "text-destructive"
            )}>
              {stats.failed}
            </div>
            <div className="text-[11px] text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Compliance Rate */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className={cn(
            "flex size-9 items-center justify-center rounded-md",
            stats.complianceRate >= 90
              ? "bg-green-100 dark:bg-green-900/20"
              : stats.complianceRate >= 75
                ? "bg-amber-100 dark:bg-amber-900/20"
                : "bg-destructive/10"
          )}>
            <TrendingUp className={cn(
              "size-4",
              stats.complianceRate >= 90
                ? "text-green-600 dark:text-green-400"
                : stats.complianceRate >= 75
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-destructive"
            )} />
          </div>
          <div>
            <div className={cn(
              "text-xl font-semibold tabular-nums",
              stats.complianceRate >= 90
                ? "text-green-600 dark:text-green-400"
                : stats.complianceRate >= 75
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-destructive"
            )}>
              {stats.complianceRate}%
            </div>
            <div className="text-[11px] text-muted-foreground">Compliance</div>
          </div>
        </div>
      </div>

      {/* Overdue Alerts Section */}
      {overdueAlerts.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <h2 className="text-sm font-semibold">
                {isInspector ? "Your Overdue Inspections" : "Overdue Inspections"}
              </h2>
              <Badge variant="destructive" className="text-[10px]">
                {overdueAlerts.length}
              </Badge>
            </div>
            <Link
              href={`/inspections?loc=${locationId}&status=overdue`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </div>
          <div className="divide-y">
            {overdueAlerts.map((alert) => {
              const urgency = getUrgencyBadge(alert.daysOverdue)
              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  {/* Urgency indicator */}
                  <div className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border",
                    getUrgencyColor(alert.daysOverdue)
                  )}>
                    <AlertTriangle className="size-3.5" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium">{alert.task}</span>
                      <Badge variant={urgency.variant} className="text-[10px]">
                        {urgency.label}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
                      <span>Due {formatDate(alert.dueAt)}</span>
                      <span className="hidden sm:inline">·</span>
                      <span>{alert.daysOverdue} days overdue</span>
                      {!isInspector && alert.assignee && (
                        <>
                          <span className="hidden sm:inline">·</span>
                          <span className="truncate">{alert.assignee}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {!isInspector && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Send reminder"
                      >
                        <Send className="size-3.5" />
                      </Button>
                    )}
                    <Link href={`/inspections?loc=${locationId}&instance=${alert.id}`}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs for Calendar and Analytics */}
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="h-8 w-full sm:w-fit">
          <TabsTrigger value="calendar" className="gap-1.5 text-xs">
            <CalendarDays className="size-3.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs">
            <BarChart3 className="size-3.5" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5 text-xs">
            <TrendingUp className="size-3.5" />
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <InspectionCalendar events={calendarEvents} locationId={locationId} locationName={locationName ?? undefined} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Weekly Trend Chart */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold">Weekly Completion Trend</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="weekLabel"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      iconSize={10}
                    />
                    <Bar dataKey="completed" name="Completed" fill={COLORS.completed} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill={COLORS.failed} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill={COLORS.pending} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Breakdown Pie Chart */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold">Status Breakdown</h3>
              <div className="h-[220px]">
                {totalInspections > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                        formatter={(value) => [value ?? 0, "Count"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No inspection data available
                  </div>
                )}
              </div>
              {totalInspections > 0 && (
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  Total: {totalInspections} inspections
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Monthly Compliance Trend - Line Chart */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold">Compliance Rate Trend (6 Months)</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyCompliance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value) => [`${value}%`, "Compliance"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="complianceRate"
                      name="Compliance Rate"
                      stroke={COLORS.compliance}
                      strokeWidth={2}
                      dot={{ fill: COLORS.compliance, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Volume - Area Chart */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold">Monthly Inspection Volume</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyCompliance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      iconSize={10}
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Completed"
                      stackId="1"
                      stroke={COLORS.completed}
                      fill={COLORS.completed}
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total Due"
                      stackId="2"
                      stroke={COLORS.pending}
                      fill={COLORS.pending}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Inspections Table */}
          {canExport && recentInspections.length > 0 && (
            <div className="mt-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Recent Inspections</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={handleExportCSV}
                  >
                    <Download className="size-3.5" />
                    Export CSV
                  </Button>
                </div>
              </div>
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Task</th>
                      <th className="px-4 py-2 text-left font-medium">Due Date</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Assignee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentInspections.slice(0, 10).map((inspection) => (
                      <tr key={inspection.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2">{inspection.task}</td>
                        <td className="px-4 py-2">{formatDate(inspection.dueAt)}</td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={
                              inspection.status === "passed"
                                ? "default"
                                : inspection.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {formatStatus(inspection.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {inspection.assignee || "Unassigned"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
