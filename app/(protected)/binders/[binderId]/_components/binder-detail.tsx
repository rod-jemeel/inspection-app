"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, FileText, Settings, ClipboardList, ClipboardCheck, Calendar, User, Pencil, Trash2, Users2, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ResponseList } from "./response-list"
import { FormTemplateDialog } from "./form-template-dialog"
import { BinderDialog } from "../../_components/binder-dialog"
import { BinderAssignmentsTab } from "./binder-assignments-tab"
import { toast } from "sonner"

interface FormTemplate {
  id: string
  binder_id: string
  name: string
  description: string | null
  instructions: string | null
  frequency: string | null
  sort_order: number
  active: boolean
  google_sheet_id: string | null
  google_sheet_tab: string | null
}

interface Binder {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
}

interface BinderDetailProps {
  binder: Binder
  templates: FormTemplate[]
  locationId: string
  canEdit: boolean
  profileId: string
}

const frequencyColors: Record<string, string> = {
  daily: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  weekly: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  monthly: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  quarterly: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  annual: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  yearly: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  every_3_years: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400",
  as_needed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  yearly: "Yearly",
  every_3_years: "Every 3 Years",
  as_needed: "As Needed",
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  passed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  failed: "Failed",
  passed: "Passed",
}

interface InspectionTemplate {
  id: string
  location_id: string
  task: string
  frequency: string
  default_assignee_profile_id: string | null
  binder_id: string | null
  assignee_name?: string | null
}

interface InspectionInstance {
  id: string
  template_id: string
  location_id: string
  due_at: string
  status: string
  assigned_to_profile_id: string | null
  template_task?: string
  assignee_name?: string | null
}

function TemplatesTab({
  binderId,
  locationId,
  canEdit,
}: {
  binderId: string
  locationId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState<InspectionTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/locations/${locationId}/templates?binder_id=${binderId}`
        )
        if (res.ok) {
          const result = await res.json()
          setTemplates(result.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [binderId, locationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-muted-foreground">Loading templates...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {templates.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() =>
                router.push(`/templates/${template.id}?loc=${locationId}`)
              }
              className="group relative flex cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-2">
                <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                <h3 className="flex-1 text-sm font-medium leading-tight">
                  {template.task}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {template.frequency && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-medium",
                      frequencyColors[template.frequency] ||
                        "bg-gray-100 text-gray-700"
                    )}
                  >
                    {frequencyLabels[template.frequency] || template.frequency}
                  </Badge>
                )}
                {template.assignee_name && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <User className="size-3" />
                    <span>{template.assignee_name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-16">
          <ClipboardList className="mb-3 size-8 text-muted-foreground/60" />
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            No templates for this binder yet
          </p>
        </div>
      )}

      {templates.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {templates.length} {templates.length === 1 ? "template" : "templates"}
        </p>
      )}
    </div>
  )
}

function InspectionsTab({
  binderId,
  locationId,
}: {
  binderId: string
  locationId: string
}) {
  const router = useRouter()
  const [instances, setInstances] = useState<InspectionInstance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInstances = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/locations/${locationId}/instances?binder_id=${binderId}`
        )
        if (res.ok) {
          const result = await res.json()
          setInstances(result.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch instances:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchInstances()
  }, [binderId, locationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-muted-foreground">Loading inspections...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {instances.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => (
            <div
              key={instance.id}
              onClick={() =>
                router.push(`/inspections/${instance.id}?loc=${locationId}`)
              }
              className="group relative flex cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-2">
                <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" />
                <h3 className="flex-1 text-sm font-medium leading-tight">
                  {instance.template_task}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={instance.status === "pending" ? "outline" : instance.status === "in_progress" ? "secondary" : instance.status === "failed" ? "destructive" : "default"}
                  className={cn(
                    "text-[10px] font-medium",
                    statusColors[instance.status] || "bg-gray-100 text-gray-700"
                  )}
                >
                  {statusLabels[instance.status] || instance.status}
                </Badge>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="size-3" />
                  <span>{new Date(instance.due_at).toLocaleDateString()}</span>
                </div>
              </div>

              {instance.assignee_name && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <User className="size-3" />
                  <span>{instance.assignee_name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-16">
          <ClipboardCheck className="mb-3 size-8 text-muted-foreground/60" />
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            No inspections for this binder yet
          </p>
        </div>
      )}

      {instances.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {instances.length} {instances.length === 1 ? "inspection" : "inspections"}
        </p>
      )}
    </div>
  )
}

export function BinderDetail({
  binder,
  templates,
  locationId,
  canEdit,
}: BinderDetailProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"forms" | "templates" | "inspections" | "responses" | "assignments">("forms")
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null)
  const [binderDialogOpen, setBinderDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates

    const query = searchQuery.toLowerCase()
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    )
  }, [templates, searchQuery])

  const handleFormClick = (formId: string) => {
    router.push(`/binders/${binder.id}/forms/${formId}?loc=${locationId}`)
  }

  const handleDeleteBinder = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/locations/${locationId}/binders/${binder.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete binder")
      toast.success("Binder deleted")
      router.push(`/binders?loc=${locationId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete binder")
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/binders?loc=${locationId}`}>
                Binders
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{binder.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {binder.color && (
                <div
                  className="size-2 rounded-full"
                  style={{ backgroundColor: binder.color }}
                />
              )}
              <h1 className="text-lg font-semibold">{binder.name}</h1>
            </div>
            {binder.description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {binder.description}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setBinderDialogOpen(true)}
              >
                <Pencil className="size-3" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-3" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "forms" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("forms")}
          className="h-8 text-xs"
        >
          Forms
        </Button>
        <Button
          variant={activeTab === "templates" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("templates")}
          className="h-8 text-xs"
        >
          Templates
        </Button>
        <Button
          variant={activeTab === "inspections" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("inspections")}
          className="h-8 text-xs"
        >
          Inspections
        </Button>
        <Button
          variant={activeTab === "responses" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("responses")}
          className="h-8 text-xs"
        >
          Responses
        </Button>
        {canEdit && (
          <Button
            variant={activeTab === "assignments" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("assignments")}
            className="h-8 text-xs"
          >
            <Users2 className="mr-1 size-3.5" />
            Assignments
          </Button>
        )}
      </div>

      {/* Forms Tab Content */}
      {activeTab === "forms" && (
        <>
          <div className="flex items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search forms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs"
              />
            </div>
            {canEdit && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingTemplate(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="size-4" />
                New Form
              </Button>
            )}
          </div>

          {/* Forms Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => handleFormClick(template.id)}
              className="group relative flex cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Form Name */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex-1 text-sm font-medium leading-tight">
                  {template.name}
                </h3>
                {canEdit && (
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Edit fields"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/binders/${binder.id}/forms/${template.id}/edit?loc=${locationId}`)
                      }}
                    >
                      <ListChecks className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Form settings"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingTemplate(template)
                        setDialogOpen(true)
                      }}
                    >
                      <Settings className="size-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Description */}
              {template.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {template.description}
                </p>
              )}

              {/* Frequency Badge */}
              {template.frequency && (
                <div className="mt-auto">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-medium",
                      frequencyColors[template.frequency] || "bg-gray-100 text-gray-700"
                    )}
                  >
                    {frequencyLabels[template.frequency] || template.frequency}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-16">
          <FileText className="mb-3 size-8 text-muted-foreground/60" />
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            {searchQuery ? "No forms found" : "No forms in this binder yet"}
          </p>
          {!searchQuery && canEdit && (
            <p className="text-xs text-muted-foreground">
              Create your first form to get started
            </p>
          )}
        </div>
      )}

          {/* Results count */}
          {templates.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Showing {filteredTemplates.length} of {templates.length}{" "}
              {templates.length === 1 ? "form" : "forms"}
            </p>
          )}
        </>
      )}

      {/* Templates Tab Content */}
      {activeTab === "templates" && (
        <TemplatesTab
          binderId={binder.id}
          locationId={locationId}
          canEdit={canEdit}
        />
      )}

      {/* Inspections Tab Content */}
      {activeTab === "inspections" && (
        <InspectionsTab binderId={binder.id} locationId={locationId} />
      )}

      {/* Responses Tab Content */}
      {activeTab === "responses" && (
        <ResponseList binderId={binder.id} locationId={locationId} />
      )}

      {/* Assignments Tab Content */}
      {activeTab === "assignments" && canEdit && (
        <BinderAssignmentsTab
          binderId={binder.id}
          locationId={locationId}
          canEdit={canEdit}
        />
      )}

      {/* Form Template Dialog */}
      {canEdit && (
        <FormTemplateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => router.refresh()}
          locationId={locationId}
          binderId={binder.id}
          template={editingTemplate}
        />
      )}

      {/* Binder Edit Dialog */}
      {canEdit && (
        <BinderDialog
          open={binderDialogOpen}
          onOpenChange={setBinderDialogOpen}
          binder={binder}
          locationId={locationId}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Binder</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the binder &quot;{binder.name}&quot; and hide it from all users. This action can be reversed by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBinder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Binder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
