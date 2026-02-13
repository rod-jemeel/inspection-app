"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TemplateCard } from "./template-card"

interface DueRule {
  dayOfWeek?: number
  dayOfMonth?: number
  month?: number
}

interface Template {
  id: string
  task: string
  description: string | null
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years"
  default_due_rule: DueRule | null
  active: boolean
  sort_order: number
  created_by: string | null
  created_by_name?: string | null
  updated_by: string | null
  updated_by_name?: string | null
  created_at: string
  updated_at: string
  binder_id: string | null
  form_template_id: string | null
}

interface SortableTemplateCardProps {
  template: Template
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}

export function SortableTemplateCard({
  template,
  canManage,
  onEdit,
  onDelete,
}: SortableTemplateCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div style={style}>
      <TemplateCard
        ref={setNodeRef}
        template={template}
        canManage={canManage}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  )
}
