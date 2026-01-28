"use client"

import Link from "next/link"
import { ClipboardList, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface DashboardContentProps {
  stats: { pending: number; overdue: number; passed: number }
  upcomingInstances: {
    id: string
    task: string
    dueAt: string
    status: string
    assignee: string | null
  }[]
  locationId: string
}

const statusVariant: Record<string, string> = {
  pending: "outline",
  in_progress: "secondary",
  overdue: "destructive",
  passed: "default",
}

export function DashboardContent({ stats, upcomingInstances, locationId }: DashboardContentProps) {
  const isOverdue = (dueAt: string) => new Date(dueAt) < new Date()

  return (
    <div className="space-y-6">
      <h1 className="text-sm font-medium">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-sm font-medium", stats.overdue > 0 && "text-destructive")}>
              {stats.overdue}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="size-4 text-primary" />
              Passed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{stats.passed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming inspections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            Upcoming Inspections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingInstances.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No pending inspections
            </p>
          ) : (
            <div className="divide-y divide-border">
              {upcomingInstances.map((inst) => (
                <Link
                  key={inst.id}
                  href={`/inspections/${inst.id}?loc=${locationId}`}
                  className="-mx-4 flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">{inst.task}</div>
                    <div className="text-muted-foreground">
                      Due: {new Date(inst.dueAt).toLocaleDateString()}
                      {inst.assignee && ` · ${inst.assignee}`}
                    </div>
                  </div>
                  <Badge
                    variant={isOverdue(inst.dueAt) ? statusVariant.overdue : (statusVariant[inst.status] ?? "outline") as any}
                    className="capitalize"
                  >
                    {isOverdue(inst.dueAt) ? "overdue" : inst.status.replace("_", " ")}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Link
          href={`/inspections?loc=${locationId}`}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-none border border-border bg-background px-2.5 text-xs font-medium transition-all hover:bg-muted hover:text-foreground"
        >
          View All Inspections
        </Link>
        <Link
          href={`/templates?loc=${locationId}`}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-none border border-border bg-background px-2.5 text-xs font-medium transition-all hover:bg-muted hover:text-foreground"
        >
          Manage Templates
        </Link>
      </div>
    </div>
  )
}
