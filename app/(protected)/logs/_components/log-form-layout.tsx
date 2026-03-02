"use client"

import { cn } from "@/lib/utils"
import { LogActionBar } from "./log-action-bar"
import { LogStatusBadge, type LogStatus } from "./log-status-badge"

interface LogFormLayoutProps {
  children: React.ReactNode
  title?: string
  status?: LogStatus
  dirty?: boolean
  saving?: boolean
  loading?: boolean
  isAdmin?: boolean
  onSave?: (status: "draft" | "complete") => void
  entityLabel?: string
  headerContent?: React.ReactNode
  topToolbar?: React.ReactNode
  secondaryToolbar?: React.ReactNode
  topMeta?: React.ReactNode
  belowContent?: React.ReactNode
  footerActions?: React.ReactNode
  className?: string
}

function LogFormHeader({
  title,
  status,
  dirty,
  loading,
  topMeta,
  topToolbar,
  headerContent,
}: {
  title?: string
  status?: LogStatus
  dirty: boolean
  loading: boolean
  topMeta?: React.ReactNode
  topToolbar?: React.ReactNode
  headerContent?: React.ReactNode
}) {
  if (topMeta) return <>{topMeta}</>
  if (!title && !status) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {title && <h3 className="text-sm font-semibold">{title}</h3>}
        {status && <LogStatusBadge status={status} />}
        {dirty && status !== "complete" && (
          <span className="text-xs text-amber-600">Unsaved changes</span>
        )}
        {loading && (
          <span className="text-xs text-muted-foreground">Loading...</span>
        )}
      </div>
      {topToolbar ?? headerContent}
    </div>
  )
}

function LogFormSecondaryToolbar({
  secondaryToolbar,
}: {
  secondaryToolbar?: React.ReactNode
}) {
  if (!secondaryToolbar) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {secondaryToolbar}
    </div>
  )
}

function LogFormFooter({
  footerActions,
  status,
  dirty,
  saving,
  isAdmin,
  entityLabel,
  onSave,
}: {
  footerActions?: React.ReactNode
  status?: LogStatus
  dirty: boolean
  saving: boolean
  isAdmin: boolean
  entityLabel: string
  onSave?: (status: "draft" | "complete") => void
}) {
  const canRenderLegacyFooter =
    status && status !== "ongoing" && typeof onSave === "function"

  if (!footerActions && !canRenderLegacyFooter) return null

  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 border-t border-border/50 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {footerActions}
      {!footerActions && canRenderLegacyFooter && onSave && (
        <LogActionBar
          status={status}
          dirty={dirty}
          saving={saving}
          isAdmin={isAdmin}
          entityLabel={entityLabel}
          onSaveDraft={() => onSave("draft")}
          onSaveComplete={() => onSave("complete")}
          onRevertToDraft={() => onSave("draft")}
        />
      )}
    </div>
  )
}

export function LogFormLayout({
  children,
  title,
  status,
  dirty = false,
  saving = false,
  loading = false,
  isAdmin = false,
  onSave,
  entityLabel = "log",
  headerContent,
  topToolbar,
  secondaryToolbar,
  topMeta,
  belowContent,
  footerActions,
  className,
}: LogFormLayoutProps) {
  return (
    <div className={cn("max-w-full space-y-4 overflow-hidden", className)}>
      <LogFormHeader
        title={title}
        status={status}
        dirty={dirty}
        loading={loading}
        topMeta={topMeta}
        topToolbar={topToolbar}
        headerContent={headerContent}
      />

      <LogFormSecondaryToolbar secondaryToolbar={secondaryToolbar} />

      {children}

      <LogFormFooter
        footerActions={footerActions}
        status={status}
        dirty={dirty}
        saving={saving}
        isAdmin={isAdmin}
        entityLabel={entityLabel}
        onSave={onSave}
      />

      {belowContent}
    </div>
  )
}
