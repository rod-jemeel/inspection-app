"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryState } from "nuqs"
import { AlertTriangle, ChevronRight, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"

interface Instance {
  id: string
  template_id: string
  template_task?: string
  template_frequency?: "weekly" | "monthly" | "yearly" | "every_3_years" | null
  due_at: string
  assigned_to_email: string | null
  status: "pending" | "in_progress" | "failed" | "passed" | "void"
  remarks: string | null
  inspected_at: string | null
}

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "failed", label: "Failed" },
  { value: "passed", label: "Passed" },
  { value: "void", label: "Void" },
] as const

const statusConfig: Record<string, { variant: string; className?: string }> = {
  pending: { variant: "outline" },
  in_progress: { variant: "secondary" },
  failed: { variant: "destructive" },
  passed: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
  void: { variant: "outline", className: "opacity-50" },
}

const FREQ_CONFIG: Record<string, { label: string; className: string }> = {
  weekly: { label: "Weekly", className: "bg-blue-100 text-blue-700 border-blue-200" },
  monthly: { label: "Monthly", className: "bg-green-100 text-green-700 border-green-200" },
  yearly: { label: "Yearly", className: "bg-amber-100 text-amber-700 border-amber-200" },
  every_3_years: { label: "Every 3 Years", className: "bg-purple-100 text-purple-700 border-purple-200" },
}

interface UrgencyGroups {
  overdue: Instance[]
  today: Instance[]
  thisWeek: Instance[]
  thisMonth: Instance[]
  thisYear: Instance[]
  later: Instance[]
  passed: Instance[]
}

interface FrequencyGroups {
  weekly: Instance[]
  monthly: Instance[]
  yearly: Instance[]
  every_3_years: Instance[]
}

// Hoisted static JSX for empty state
const EmptyState = (
  <div className="py-20 text-center text-xs text-muted-foreground">
    No inspections found
  </div>
)

export function InspectionList({
  instances,
  locationId,
  activeStatus,
}: {
  instances: Instance[]
  locationId: string
  activeStatus?: string
}) {
  const router = useRouter()
  const [, setInstanceId] = useQueryState("instance")
  const [search, setSearch] = useState("")
  const [groupView, setGroupView] = useState<"urgency" | "frequency">("urgency")

  // Cache current time to avoid creating new Date objects repeatedly
  const now = useMemo(() => new Date(), [])

  const isOverdue = useCallback(
    (dueAt: string, status: string) =>
      (status === "pending" || status === "in_progress") && new Date(dueAt) < now,
    [now]
  )

  // Prefetch instance data on hover for faster modal loading
  const prefetchInstance = useCallback(
    (instanceId: string) => {
      // Use link prefetching by fetching the API route
      fetch(`/api/locations/${locationId}/instances/${instanceId}`)
    },
    [locationId]
  )

  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      // Hide void unless explicitly filtered for void or showing all
      if (inst.status === "void" && activeStatus !== "void" && activeStatus !== undefined) return false
      // Search filter
      if (search) {
        const query = search.toLowerCase()
        return (
          inst.id.toLowerCase().includes(query) ||
          inst.template_task?.toLowerCase().includes(query) ||
          inst.assigned_to_email?.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [instances, search, activeStatus])

  // Group by urgency
  const groupedByUrgency = useMemo<UrgencyGroups>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // End of this week (Sunday)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))

    // End of this month
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    // End of this year
    const endOfYear = new Date(today.getFullYear(), 11, 31)

    const groups: UrgencyGroups = {
      overdue: [],
      today: [],
      thisWeek: [],
      thisMonth: [],
      thisYear: [],
      later: [],
      passed: [],
    }

    for (const inst of filteredInstances) {
      // Passed items go to passed section
      if (inst.status === "passed") {
        groups.passed.push(inst)
        continue
      }

      // Void items go to later
      if (inst.status === "void") {
        groups.later.push(inst)
        continue
      }

      const dueDate = new Date(inst.due_at)
      dueDate.setHours(0, 0, 0, 0)

      if (dueDate < today) {
        groups.overdue.push(inst)
      } else if (dueDate.getTime() === today.getTime()) {
        groups.today.push(inst)
      } else if (dueDate <= endOfWeek) {
        groups.thisWeek.push(inst)
      } else if (dueDate <= endOfMonth) {
        groups.thisMonth.push(inst)
      } else if (dueDate <= endOfYear) {
        groups.thisYear.push(inst)
      } else {
        groups.later.push(inst)
      }
    }

    return groups
  }, [filteredInstances])

  // Group by frequency
  const groupedByFrequency = useMemo<FrequencyGroups>(() => {
    const groups: FrequencyGroups = { weekly: [], monthly: [], yearly: [], every_3_years: [] }

    for (const inst of filteredInstances) {
      const freq = inst.template_frequency ?? "monthly"
      if (freq in groups) {
        groups[freq as keyof FrequencyGroups].push(inst)
      } else {
        groups.monthly.push(inst)
      }
    }

    return groups
  }, [filteredInstances])

  const formatDueDate = useCallback(
    (dueAt: string) => {
      const date = new Date(dueAt)
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)

      if (date.toDateString() === now.toDateString()) return "Today"
      if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow"
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    },
    [now]
  )

  const renderInstanceCard = useCallback(
    (inst: Instance) => {
      const overdue = isOverdue(inst.due_at, inst.status)
      const config = statusConfig[inst.status] ?? { variant: "outline" }

      return (
        <button
          key={inst.id}
          onClick={() => setInstanceId(inst.id)}
          onMouseEnter={() => prefetchInstance(inst.id)}
          onFocus={() => prefetchInstance(inst.id)}
          className={cn(
            "group flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left shadow-sm transition-all",
            "hover:border-primary/50 hover:shadow-md",
            inst.status === "void" && "opacity-60"
          )}
        >
          {/* Overdue indicator */}
          {overdue && (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10">
              <AlertTriangle className="size-4 text-destructive" />
            </div>
          )}

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium">
                {inst.template_task || `Inspection #${inst.id}`}
              </span>
            </div>
            <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
              <span className={cn(overdue && "text-destructive font-medium")}>
                Due {formatDueDate(inst.due_at)}
              </span>
              {inst.assigned_to_email && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className="truncate">{inst.assigned_to_email}</span>
                </>
              )}
            </div>
          </div>

          {/* Badges and arrow */}
          <div className="flex shrink-0 items-center gap-2">
            {inst.template_frequency && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  FREQ_CONFIG[inst.template_frequency]?.className
                )}
              >
                {FREQ_CONFIG[inst.template_frequency]?.label ?? "Unknown"}
              </Badge>
            )}
            <Badge
              variant={config.variant as "outline" | "secondary" | "destructive" | "default"}
              className={cn("text-[10px] capitalize", config.className)}
            >
              {inst.status.replace("_", " ")}
            </Badge>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      )
    },
    [isOverdue, prefetchInstance, setInstanceId, formatDueDate]
  )

  const renderCollapsibleSection = (
    title: string,
    items: Instance[],
    defaultOpen: boolean = true,
    headerClassName?: string
  ) => {
    if (items.length === 0) return null

    return (
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted">
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90 [[data-state=open]>&]:rotate-90" />
          <span className={cn("text-xs font-medium", headerClassName)}>{title}</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {items.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-1 gap-3 pb-4 pt-2 md:grid-cols-2">
            {items.map(renderInstanceCard)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search inspections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Status filter buttons */}
        <div className="grid flex-1 grid-cols-3 gap-1.5 sm:flex sm:flex-none sm:flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => {
                const params = new URLSearchParams({ loc: locationId })
                if (tab.value) params.set("status", tab.value)
                router.push(`/inspections?${params.toString()}`)
              }}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                activeStatus === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
                tab.value === "void" && "text-muted-foreground/70"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Group View Tabs */}
      <Tabs value={groupView} onValueChange={(v) => setGroupView(v as "urgency" | "frequency")}>
        <TabsList className="h-8 w-full sm:w-fit">
          <TabsTrigger value="urgency" className="text-xs sm:flex-initial">
            By Urgency
          </TabsTrigger>
          <TabsTrigger value="frequency" className="text-xs sm:flex-initial">
            By Frequency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="urgency" className="mt-4 space-y-4">
          {renderCollapsibleSection("Overdue", groupedByUrgency.overdue, true, "text-destructive")}
          {renderCollapsibleSection("Due Today", groupedByUrgency.today, true)}
          {renderCollapsibleSection("This Week", groupedByUrgency.thisWeek, true)}
          {renderCollapsibleSection("This Month", groupedByUrgency.thisMonth, true)}
          {renderCollapsibleSection("This Year", groupedByUrgency.thisYear, false)}
          {renderCollapsibleSection("Later", groupedByUrgency.later, false)}
          {renderCollapsibleSection("Passed", groupedByUrgency.passed, false, "text-green-600")}

          {filteredInstances.length === 0 && EmptyState}
        </TabsContent>

        <TabsContent value="frequency" className="mt-4 space-y-4">
          {renderCollapsibleSection("Weekly", groupedByFrequency.weekly, true)}
          {renderCollapsibleSection("Monthly", groupedByFrequency.monthly, true)}
          {renderCollapsibleSection("Yearly", groupedByFrequency.yearly, true)}
          {renderCollapsibleSection("Every 3 Years", groupedByFrequency.every_3_years, false)}

          {filteredInstances.length === 0 && EmptyState}
        </TabsContent>
      </Tabs>
    </div>
  )
}
