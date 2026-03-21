"use client"

import { useState, useEffect } from "react"
import { Loader2, Settings, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface MemberDetailDialogProps {
  member: {
    id: string
    user_id: string
    full_name: string
    email: string | null
    username: string | null
    role: string
    can_manage_binders: boolean
    can_manage_forms: boolean
    can_view_all_responses: boolean
    can_export_reports: boolean
    can_configure_integrations: boolean
  } | null
  locationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  canEdit: boolean
}

interface BinderAssignment {
  binder_id: string
  binder_name: string
  binder_color: string | null
  can_edit: boolean
}

interface Binder {
  id: string
  name: string
  color: string | null
}

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  nurse: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  inspector: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
}

const PERMISSION_CONFIG = [
  {
    key: "can_manage_binders" as const,
    label: "Manage Binders",
    description: "Create, edit, and delete binders",
  },
  {
    key: "can_manage_forms" as const,
    label: "Manage Forms",
    description: "Create, edit form templates and fields",
  },
  {
    key: "can_view_all_responses" as const,
    label: "View All Responses",
    description: "See form responses across all binders",
  },
  {
    key: "can_export_reports" as const,
    label: "Export Reports",
    description: "Download reports and data exports",
  },
  {
    key: "can_configure_integrations" as const,
    label: "Configure Integrations",
    description: "Set up external integrations",
  },
]

export function MemberDetailDialog({
  member,
  locationId,
  open,
  onOpenChange,
  onSuccess,
  canEdit,
}: MemberDetailDialogProps) {
  const [allBinders, setAllBinders] = useState<Binder[]>([])
  const [assignments, setAssignments] = useState<BinderAssignment[]>([])
  const [pendingAssignments, setPendingAssignments] = useState<BinderAssignment[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [savingAssignments, setSavingAssignments] = useState(false)
  const [savingPermission, setSavingPermission] = useState<string | null>(null)

  // Fetch binders + assignments when dialog opens
  useEffect(() => {
    if (!open || !member) return

    setLoadingAssignments(true)
    Promise.all([
      fetch(`/api/locations/${locationId}/binders`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/locations/${locationId}/members/${member.id}/assignments`).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([binders, currentAssignments]) => {
        setAllBinders(binders ?? [])
        const normalized: BinderAssignment[] = (currentAssignments ?? []).map(
          (a: { binder_id: string; binder_name: string; binder_color: string | null; can_edit: boolean }) => ({
            binder_id: a.binder_id,
            binder_name: a.binder_name,
            binder_color: a.binder_color,
            can_edit: a.can_edit,
          })
        )
        setAssignments(normalized)
        setPendingAssignments(normalized)
      })
      .catch(() => {
        toast.error("Failed to load binder assignments")
      })
      .finally(() => setLoadingAssignments(false))
  }, [open, member, locationId])

  const isAssigned = (binderId: string) =>
    pendingAssignments.some((a) => a.binder_id === binderId)

  const canEditBinder = (binderId: string) =>
    pendingAssignments.find((a) => a.binder_id === binderId)?.can_edit ?? false

  const handleToggleAssigned = (binder: Binder) => {
    setPendingAssignments((prev) => {
      if (prev.some((a) => a.binder_id === binder.id)) {
        return prev.filter((a) => a.binder_id !== binder.id)
      }
      return [...prev, { binder_id: binder.id, binder_name: binder.name, binder_color: binder.color, can_edit: false }]
    })
  }

  const handleToggleCanEdit = (binderId: string) => {
    setPendingAssignments((prev) =>
      prev.map((a) => (a.binder_id === binderId ? { ...a, can_edit: !a.can_edit } : a))
    )
  }

  const handleSaveAssignments = async () => {
    if (!member) return
    setSavingAssignments(true)
    try {
      const res = await fetch(`/api/locations/${locationId}/members/${member.id}/assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: pendingAssignments.map((a) => ({
            binder_id: a.binder_id,
            can_edit: a.can_edit,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error?.message ?? "Failed to save assignments")
        return
      }
      const saved: BinderAssignment[] = await res.json()
      setAssignments(saved)
      setPendingAssignments(saved)
      toast.success("Binder assignments saved")
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSavingAssignments(false)
    }
  }

  const assignmentsDirty =
    JSON.stringify(pendingAssignments.map((a) => a.binder_id + a.can_edit).sort()) !==
    JSON.stringify(assignments.map((a) => a.binder_id + a.can_edit).sort())

  if (!member) return null

  const isOwnerOrAdmin = member.role === "owner" || member.role === "admin"
  const canEditPermissions = canEdit && !isOwnerOrAdmin

  const handleTogglePermission = async (key: string, currentValue: boolean) => {
    if (!canEditPermissions) return

    setSavingPermission(key)
    try {
      const res = await fetch(`/api/locations/${locationId}/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: { [key]: !currentValue } }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error?.message ?? "Failed to update permission")
        return
      }

      toast.success("Permission updated")
      onSuccess()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSavingPermission(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{member.full_name}</DialogTitle>
            <Badge
              variant="outline"
              className={cn("text-[10px]", roleColors[member.role] || roleColors.inspector)}
            >
              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Permissions Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Settings className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Permissions</h3>
            </div>

            {isOwnerOrAdmin ? (
              <div className="rounded-md border border-muted bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  {member.role === "owner" ? "Owners" : "Admins"} have all permissions enabled by default.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {PERMISSION_CONFIG.map((perm) => {
                  const currentValue = member[perm.key]
                  const isSaving = savingPermission === perm.key

                  return (
                    <div
                      key={perm.key}
                      className="flex items-start justify-between gap-4 rounded-md border p-3"
                    >
                      <div className="flex-1 space-y-0.5">
                        <div className="text-xs font-medium">{perm.label}</div>
                        <div className="text-xs text-muted-foreground">{perm.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSaving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                        <Switch
                          checked={currentValue}
                          onCheckedChange={() => handleTogglePermission(perm.key, currentValue)}
                          disabled={!canEditPermissions || isSaving}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Binder Assignments Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Binder Assignments</h3>
            </div>

            {isOwnerOrAdmin ? (
              <div className="rounded-md border border-muted bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  {member.role === "owner" ? "Owners" : "Admins"} have access to all binders by default.
                </p>
              </div>
            ) : loadingAssignments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : allBinders.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center">
                <p className="text-xs text-muted-foreground">No binders found for this location.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {allBinders.map((binder) => {
                    const assigned = isAssigned(binder.id)
                    const canEdit = canEditBinder(binder.id)
                    return (
                      <div
                        key={binder.id}
                        className="flex items-center gap-3 rounded-md border p-2.5"
                      >
                        <div
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: binder.color ?? "#6b7280" }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium">{binder.name}</div>
                        </div>
                        {assigned && canEditPermissions && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Can edit</span>
                            <Switch
                              checked={canEdit}
                              onCheckedChange={() => handleToggleCanEdit(binder.id)}
                              disabled={savingAssignments}
                              className="scale-75"
                            />
                          </div>
                        )}
                        {assigned && !canEditPermissions && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              canEdit
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300"
                                : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300"
                            )}
                          >
                            {canEdit ? "Editor" : "Viewer"}
                          </Badge>
                        )}
                        {canEditPermissions && (
                          <Switch
                            checked={assigned}
                            onCheckedChange={() => handleToggleAssigned(binder)}
                            disabled={savingAssignments}
                            className="scale-75"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {canEditPermissions && (
                  <Button
                    size="sm"
                    onClick={handleSaveAssignments}
                    disabled={!assignmentsDirty || savingAssignments}
                    className="w-full"
                  >
                    {savingAssignments && <Loader2 className="size-3.5 animate-spin" />}
                    Save Assignments
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
