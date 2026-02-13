"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TemplateDialog } from "./template-dialog"
import { FrequencySection } from "./frequency-section"

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

const FREQUENCY_ORDER = ["daily", "weekly", "monthly", "quarterly", "yearly", "every_3_years"] as const

function groupByFrequency(templates: Template[]) {
  const groups: Record<string, Template[]> = {
    daily: [],
    weekly: [],
    monthly: [],
    quarterly: [],
    yearly: [],
    every_3_years: [],
  }
  for (const t of templates) {
    if (groups[t.frequency]) {
      groups[t.frequency].push(t)
    }
  }
  return groups
}

export function TemplateList({
  templates: initialTemplates,
  locationId,
  canManage,
  formTemplates,
  binders,
  activeBinder,
}: {
  templates: Template[]
  locationId: string
  canManage: boolean
  formTemplates?: { id: string; name: string; binder_id: string; binder_name: string }[]
  binders?: { id: string; name: string }[]
  activeBinder?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [templates, setTemplates] = useState(initialTemplates)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)

  // Filter templates based on search and active status
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // Filter by active status
      if (!showInactive && !t.active) return false
      // Filter by search
      if (search) {
        const query = search.toLowerCase()
        return (
          t.task.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [templates, search, showInactive])

  const grouped = useMemo(() => groupByFrequency(filteredTemplates), [filteredTemplates])

  const handleEdit = useCallback((template: Template) => {
    setEditingTemplate(template)
    setDialogOpen(true)
  }, [])

  const handleCreate = useCallback(() => {
    setEditingTemplate(null)
    setDialogOpen(true)
  }, [])

  const handleDialogSuccess = useCallback(
    (updated: Template) => {
      if (editingTemplate) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        )
      } else {
        setTemplates((prev) => [updated, ...prev])
      }
    },
    [editingTemplate]
  )

  const handleReorder = useCallback(
    async (frequency: string, orderedIds: string[]) => {
      // Optimistic update
      setTemplates((prev) => {
        const newTemplates = [...prev]
        const frequencyTemplates = newTemplates.filter(
          (t) => t.frequency === frequency
        )
        const reorderedMap = new Map(
          orderedIds.map((id, index) => [id, index])
        )
        for (const t of frequencyTemplates) {
          const newOrder = reorderedMap.get(t.id)
          if (newOrder !== undefined) {
            t.sort_order = newOrder
          }
        }
        return newTemplates
      })

      // Persist to API
      try {
        const res = await fetch(
          `/api/locations/${locationId}/templates/reorder`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ frequency, order: orderedIds }),
          }
        )
        if (!res.ok) {
          // Revert on error
          router.refresh()
        }
      } catch {
        router.refresh()
      }
    },
    [locationId, router]
  )

  const handleDelete = useCallback((template: Template) => {
    setDeleteTemplate(template)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteTemplate) return
    setIsDeleting(true)

    try {
      const res = await fetch(
        `/api/locations/${locationId}/templates/${deleteTemplate.id}`,
        { method: "DELETE" }
      )
      if (res.ok) {
        // Remove from local state (soft delete sets active = false)
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === deleteTemplate.id ? { ...t, active: false } : t
          )
        )
      }
    } catch {
      // Ignore errors, will show on next refresh
    } finally {
      setIsDeleting(false)
      setDeleteTemplate(null)
      router.refresh()
    }
  }, [deleteTemplate, locationId, router])

  const hasTemplates = templates.length > 0
  const hasFilteredTemplates = filteredTemplates.length > 0

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center gap-3">
        {/* Search & Filters */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        {binders && binders.length > 0 && (
          <Select
            value={activeBinder || "__all__"}
            onValueChange={(v) => {
              const params = new URLSearchParams(searchParams)
              if (v === "__all__") {
                params.delete("binder")
              } else {
                params.set("binder", v)
              }
              router.push(`/templates?${params.toString()}`)
            }}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All binders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">All Binders</SelectItem>
              {binders.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-3.5 rounded border"
          />
          <span className="hidden sm:inline">Show inactive</span>
        </label>
        {canManage && (
          <Button size="sm" onClick={handleCreate} className="px-2 sm:px-3">
            <Plus className="size-4 sm:size-3.5" />
            <span className="hidden sm:inline">New Template</span>
          </Button>
        )}
      </div>

      {/* Template Sections */}
      {!hasTemplates ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          No templates yet.{" "}
          {canManage && "Create your first template to get started."}
        </div>
      ) : !hasFilteredTemplates ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          No templates match your search.
        </div>
      ) : (
        <div className="space-y-2">
          {FREQUENCY_ORDER.map((freq) => {
            const freqTemplates = grouped[freq]
            if (freqTemplates.length === 0) return null
            return (
              <FrequencySection
                key={freq}
                frequency={freq}
                templates={freqTemplates}
                canManage={canManage}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            )
          })}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        locationId={locationId}
        template={editingTemplate}
        onSuccess={handleDialogSuccess}
        formTemplates={formTemplates}
        binders={binders}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTemplate?.task}&quot;? This will
              deactivate the template. Existing inspection records will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
