"use client"

import { forwardRef } from "react"
import { GripVertical, Trash2, Calendar, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface DueRule {
  dayOfWeek?: number
  dayOfMonth?: number
  month?: number
}

interface Template {
  id: string
  task: string
  description: string | null
  frequency: "weekly" | "monthly" | "yearly" | "every_3_years"
  default_due_rule: DueRule | null
  default_assignee_email: string | null
  active: boolean
  sort_order: number
  created_by: string | null
  created_by_name?: string | null
  updated_by: string | null
  updated_by_name?: string | null
  created_at: string
  updated_at: string
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// Frequency badge colors
const FREQUENCY_COLORS: Record<string, string> = {
  weekly: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  monthly: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  yearly: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  every_3_years: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  every_3_years: "Every 3 Years",
}

function formatDueDate(frequency: string, rule: DueRule | null): string | null {
  if (!rule) return null

  switch (frequency) {
    case "weekly":
      if (rule.dayOfWeek !== undefined) {
        return DAYS_OF_WEEK[rule.dayOfWeek]
      }
      break
    case "monthly":
      if (rule.dayOfMonth !== undefined) {
        const suffix = getOrdinalSuffix(rule.dayOfMonth)
        return `${rule.dayOfMonth}${suffix}`
      }
      break
    case "yearly":
    case "every_3_years":
      if (rule.month !== undefined && rule.dayOfMonth !== undefined) {
        const suffix = getOrdinalSuffix(rule.dayOfMonth)
        return `${MONTHS[rule.month - 1]} ${rule.dayOfMonth}${suffix}`
      }
      break
  }
  return null
}

function getOrdinalSuffix(n: number): string {
  if (n > 3 && n < 21) return "th"
  switch (n % 10) {
    case 1: return "st"
    case 2: return "nd"
    case 3: return "rd"
    default: return "th"
  }
}

interface TemplateCardProps {
  template: Template
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  isDragging?: boolean
}

export const TemplateCard = forwardRef<HTMLDivElement, TemplateCardProps>(
  function TemplateCard(
    { template, canManage, onEdit, onDelete, dragHandleProps, isDragging },
    ref
  ) {
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't trigger edit if clicking on drag handle or delete button
      const target = e.target as HTMLElement
      if (target.closest("[data-drag-handle]") || target.closest("[data-delete-button]")) {
        return
      }
      if (canManage) {
        onEdit()
      }
    }

    return (
      <div
        ref={ref}
        onClick={handleCardClick}
        className={cn(
          "group relative flex items-center gap-2 rounded-md border bg-card p-3 shadow-sm transition-shadow",
          isDragging && "shadow-lg ring-2 ring-primary/20",
          !template.active && "opacity-60",
          canManage && "cursor-pointer hover:border-primary/50 hover:shadow-md"
        )}
      >
        {canManage && (
          <button
            type="button"
            data-drag-handle
            className="flex-shrink-0 cursor-grab touch-none text-muted-foreground opacity-100 transition-opacity hover:text-foreground md:opacity-0 md:group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...dragHandleProps}
          >
            <GripVertical className="size-4" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-xs font-medium">{template.task}</h3>
            {!template.active && (
              <Badge variant="outline" className="flex-shrink-0 text-[10px] opacity-70">
                Inactive
              </Badge>
            )}
          </div>
          {template.description && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
              {template.description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {/* Frequency badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium",
                FREQUENCY_COLORS[template.frequency]
              )}
            >
              {FREQUENCY_LABELS[template.frequency]}
            </Badge>
            {/* Due date badge */}
            {template.default_due_rule && (
              <Badge
                variant="outline"
                className="bg-muted/50 text-[10px] font-medium"
              >
                <Calendar className="mr-1 size-3" />
                {formatDueDate(template.frequency, template.default_due_rule)}
              </Badge>
            )}
            {/* Assignee badge */}
            {template.default_assignee_email && (
              <Badge
                variant="outline"
                className="bg-muted/50 text-[10px] font-medium"
              >
                <User className="mr-1 size-3" />
                {template.default_assignee_email}
              </Badge>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex flex-shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              data-delete-button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label="Delete template"
              className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    )
  }
)
