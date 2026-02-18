"use client"

import { Save, CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface LogFormLayoutProps {
  children: React.ReactNode
  title: string
  status: "draft" | "complete"
  dirty: boolean
  saving: boolean
  isAdmin: boolean
  onSave: (status: "draft" | "complete") => void
  /** Custom label for the "submitted as complete" message. Defaults to "log" */
  entityLabel?: string
  /** Optional header content (nav controls, tabs, etc.) rendered after title row */
  headerContent?: React.ReactNode
}

export function LogFormLayout({
  children,
  title,
  status,
  dirty,
  saving,
  isAdmin,
  onSave,
  entityLabel = "log",
  headerContent,
}: LogFormLayoutProps) {
  const isComplete = status === "complete"

  return (
    <div className="space-y-4 overflow-hidden max-w-full">
      {/* Header row: title + badge + dirty indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant={status === "complete" ? "default" : "secondary"} className="text-[10px]">
            {status}
          </Badge>
          {dirty && !isComplete && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}
        </div>
        {headerContent}
      </div>

      {/* Form content */}
      {children}

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 border-t border-border/50 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex flex-wrap items-center gap-2">
        {/* When editable: Save Draft + Submit as Complete */}
        {!isComplete && (
          <>
            <Button size="sm" variant="outline" onClick={() => onSave("draft")} disabled={saving || !dirty}>
              <Save className="mr-1 size-3" />
              {saving ? "Saving…" : "Save Draft"}
            </Button>
            <Button size="sm" onClick={() => onSave("complete")} disabled={saving}>
              <CheckCircle2 className="mr-1 size-3" />
              {saving ? "Saving…" : "Submit as Complete"}
            </Button>
          </>
        )}
        {/* Admin can revert */}
        {isComplete && isAdmin && (
          <Button size="sm" variant="outline" onClick={() => onSave("draft")} disabled={saving}>
            <RotateCcw className="mr-1 size-3" />
            {saving ? "Reverting…" : "Revert to Draft"}
          </Button>
        )}
        {/* Non-admin sees message */}
        {isComplete && !isAdmin && (
          <p className="text-xs text-muted-foreground">
            This {entityLabel} has been submitted as complete. Contact an admin to revert.
          </p>
        )}
      </div>
    </div>
  )
}
