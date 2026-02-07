"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Settings } from "lucide-react"
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
import type { Role } from "@/lib/permissions"

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
  binder_color: string
  access_level: "editor" | "viewer"
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
  const router = useRouter()
  const [assignments, setAssignments] = useState<BinderAssignment[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [savingPermission, setSavingPermission] = useState<string | null>(null)

  // Fetch binder assignments when dialog opens
  useEffect(() => {
    if (open && member) {
      setLoadingAssignments(true)
      fetch(`/api/locations/${locationId}/members/${member.id}/assignments`)
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error("Failed to load assignments")
        })
        .then((data) => setAssignments(data.assignments || []))
        .catch(() => {
          toast.error("Failed to load binder assignments")
          setAssignments([])
        })
        .finally(() => setLoadingAssignments(false))
    }
  }, [open, member, locationId])

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
            <h3 className="text-sm font-medium">Binder Assignments</h3>

            {loadingAssignments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  No binder assignments yet.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Manage assignments from individual binder pages.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.binder_id}
                    className="flex items-center gap-3 rounded-md border p-2.5"
                  >
                    <div
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: assignment.binder_color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium">{assignment.binder_name}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        assignment.access_level === "editor"
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300"
                          : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300"
                      )}
                    >
                      {assignment.access_level === "editor" ? "Editor" : "Viewer"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
