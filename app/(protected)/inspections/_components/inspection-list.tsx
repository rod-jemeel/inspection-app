"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ChevronRight, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface Instance {
  id: string
  template_id: string
  template_task?: string
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
] as const

const statusConfig: Record<string, { variant: string; className?: string }> = {
  pending: { variant: "outline" },
  in_progress: { variant: "secondary" },
  failed: { variant: "destructive" },
  passed: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
  void: { variant: "outline", className: "opacity-50" },
}

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
  const [search, setSearch] = useState("")
  const [showVoid, setShowVoid] = useState(false)

  const isOverdue = (dueAt: string, status: string) =>
    (status === "pending" || status === "in_progress") && new Date(dueAt) < new Date()

  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      // Hide void unless toggled
      if (!showVoid && inst.status === "void") return false
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
  }, [instances, search, showVoid])

  const formatDueDate = (dueAt: string) => {
    const date = new Date(dueAt)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return "Today"
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow"
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center gap-3">
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
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showVoid}
            onChange={(e) => setShowVoid(e.target.checked)}
            className="size-3.5 rounded border"
          />
          <span className="hidden sm:inline">Show void</span>
        </label>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.label}
            variant={activeStatus === tab.value ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 text-xs",
              activeStatus !== tab.value && "text-muted-foreground"
            )}
            onClick={() => {
              const params = new URLSearchParams({ loc: locationId })
              if (tab.value) params.set("status", tab.value)
              router.push(`/inspections?${params.toString()}`)
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Instance list */}
      {filteredInstances.length === 0 ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          No inspections found
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInstances.map((inst) => {
            const overdue = isOverdue(inst.due_at, inst.status)
            const config = statusConfig[inst.status] ?? { variant: "outline" }

            return (
              <Link
                key={inst.id}
                href={`/inspections/${inst.id}?loc=${locationId}`}
                className={cn(
                  "group flex items-center gap-3 rounded-md border bg-card p-3 shadow-sm transition-all",
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
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className={cn(overdue && "text-destructive font-medium")}>
                      Due {formatDueDate(inst.due_at)}
                    </span>
                    {inst.assigned_to_email && (
                      <>
                        <span>·</span>
                        <span className="truncate">{inst.assigned_to_email}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status badge and arrow */}
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={config.variant as any}
                    className={cn("text-[10px] capitalize", config.className)}
                  >
                    {inst.status.replace("_", " ")}
                  </Badge>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
