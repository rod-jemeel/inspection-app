"use client"

import { useState, useId } from "react"
import { ChevronRight } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SortableTemplateCard } from "./sortable-template-card"

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

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  every_3_years: "Every 3 Years",
}

interface FrequencySectionProps {
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years"
  templates: Template[]
  canManage: boolean
  onEdit: (template: Template) => void
  onDelete: (template: Template) => void
  onReorder: (frequency: string, orderedIds: string[]) => void
}

export function FrequencySection({
  frequency,
  templates,
  canManage,
  onEdit,
  onDelete,
  onReorder,
}: FrequencySectionProps) {
  const [open, setOpen] = useState(true)
  const dndId = useId()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = templates.findIndex((t) => t.id === active.id)
      const newIndex = templates.findIndex((t) => t.id === over.id)

      const reordered = [...templates]
      const [removed] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, removed)

      onReorder(frequency, reordered.map((t) => t.id))
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted">
        <ChevronRight
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="text-xs font-medium">{FREQ_LABELS[frequency]}</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {templates.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={templates.map((t) => t.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-3 pb-4 pt-2 md:grid-cols-2">
              {templates.map((template) => (
                <SortableTemplateCard
                  key={template.id}
                  template={template}
                  canManage={canManage}
                  onEdit={() => onEdit(template)}
                  onDelete={() => onDelete(template)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  )
}
