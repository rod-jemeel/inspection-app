"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Warning, ArrowRight } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Instance {
  id: string
  template_id: string
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

const statusVariant: Record<string, string> = {
  pending: "outline",
  in_progress: "secondary",
  failed: "destructive",
  passed: "default",
  void: "ghost",
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
  const isOverdue = (dueAt: string, status: string) =>
    (status === "pending" || status === "in_progress") && new Date(dueAt) < new Date()

  return (
    <div className="space-y-6">
      <h1 className="text-sm font-medium">Inspections</h1>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.label}
            variant={activeStatus === tab.value ? "default" : "outline"}
            size="xs"
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
      {instances.length === 0 ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          No inspections found
        </div>
      ) : (
        <div className="space-y-1">
          {instances.map((inst) => (
            <Link
              key={inst.id}
              href={`/inspections/${inst.id}?loc=${locationId}`}
              className="flex items-center justify-between rounded-none border border-transparent px-3 py-2.5 text-xs hover:border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isOverdue(inst.due_at, inst.status) && (
                  <Warning weight="bold" className="size-4 text-destructive shrink-0" />
                )}
                <div className="space-y-0.5">
                  <div className="font-medium">Inspection #{inst.id.slice(0, 8)}</div>
                  <div className="text-muted-foreground">
                    Due: {new Date(inst.due_at).toLocaleDateString()}
                    {inst.assigned_to_email && ` · ${inst.assigned_to_email}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={(statusVariant[inst.status] ?? "outline") as any} className="capitalize">
                  {inst.status.replace("_", " ")}
                </Badge>
                <ArrowRight weight="bold" className="size-3.5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
