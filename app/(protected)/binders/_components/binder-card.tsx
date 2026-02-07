"use client"

import { ArrowRight, FolderOpen, FileText, Folder } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Binder {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sort_order: number
  active: boolean
  form_count?: number
}

interface BinderCardProps {
  binder: Binder
  locationId: string
  onClick: () => void
}

// Map icon names to Lucide icons
const ICON_MAP: Record<string, React.ElementType> = {
  folder: Folder,
  "folder-open": FolderOpen,
  file: FileText,
}

export function BinderCard({ binder, onClick }: BinderCardProps) {
  const IconComponent = binder.icon ? ICON_MAP[binder.icon] || FolderOpen : FolderOpen

  return (
    <div
      onClick={onClick}
      style={{ borderLeftColor: binder.color || "#6B7280" }}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-2 rounded-md border border-l-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        !binder.active && "opacity-60"
      )}
    >
      {/* Header: Icon + Name */}
      <div className="flex items-start gap-2">
        <div
          className="flex-shrink-0 rounded-md p-1.5"
          style={{ backgroundColor: `${binder.color || "#6B7280"}20` }}
        >
          <IconComponent
            className="size-4"
            style={{ color: binder.color || "#6B7280" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-medium">{binder.name}</h3>
          {!binder.active && (
            <Badge variant="outline" className="mt-1 text-[10px] opacity-70">
              Inactive
            </Badge>
          )}
        </div>
      </div>

      {/* Description */}
      {binder.description && (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">
          {binder.description}
        </p>
      )}

      {/* Footer: Form count + Arrow */}
      <div className="mt-auto flex items-center justify-between">
        <Badge variant="outline" className="bg-muted/50 text-[10px] font-medium">
          <FileText className="mr-1 size-3" />
          {binder.form_count || 0} {binder.form_count === 1 ? "form" : "forms"}
        </Badge>
        <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  )
}
