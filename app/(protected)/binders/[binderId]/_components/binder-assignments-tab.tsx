"use client"

import { useState, useEffect } from "react"
import { Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface AssignmentsTabProps {
  binderId: string
  locationId: string
  canEdit: boolean
}

interface Assignment {
  id: string
  binder_id: string
  profile_id: string
  can_edit: boolean
  assigned_at: string
  assigned_by_profile_id: string
}

interface TeamMember {
  id: string
  user_id: string
  full_name: string
  email: string | null
  username: string | null
  role: string
  created_at: string
}

interface MemberWithAssignment extends TeamMember {
  isAssigned: boolean
  canEdit: boolean
  assignmentId?: string
}

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  nurse: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  inspector: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
}

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  nurse: "Staff",
  inspector: "Inspector",
}

export function BinderAssignmentsTab({ binderId, locationId, canEdit }: AssignmentsTabProps) {
  const [members, setMembers] = useState<MemberWithAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [assignmentsRes, membersRes] = await Promise.all([
          fetch(`/api/locations/${locationId}/binders/${binderId}/assignments`),
          fetch(`/api/locations/${locationId}/members`),
        ])

        if (!assignmentsRes.ok || !membersRes.ok) {
          toast.error("Failed to load assignments")
          return
        }

        const assignments: Assignment[] = await assignmentsRes.json()
        const teamMembers: TeamMember[] = await membersRes.json()

        // Merge assignments with team members
        const assignmentMap = new Map(
          assignments.map((a) => [a.profile_id, { canEdit: a.can_edit, id: a.id }])
        )

        const merged = teamMembers.map((member) => {
          const assignment = assignmentMap.get(member.id)
          return {
            ...member,
            isAssigned: !!assignment,
            canEdit: assignment?.canEdit ?? false,
            assignmentId: assignment?.id,
          }
        })

        setMembers(merged)
      } catch (error) {
        console.error("Failed to fetch data:", error)
        toast.error("Failed to load assignments")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [binderId, locationId])

  const toggleAssignment = (profileId: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === profileId ? { ...m, isAssigned: !m.isAssigned, canEdit: m.isAssigned ? false : m.canEdit } : m
      )
    )
    setHasChanges(true)
  }

  const toggleCanEdit = (profileId: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === profileId ? { ...m, canEdit: !m.canEdit } : m))
    )
    setHasChanges(true)
  }

  const selectAll = () => {
    setMembers((prev) => prev.map((m) => ({ ...m, isAssigned: true })))
    setHasChanges(true)
  }

  const deselectAll = () => {
    setMembers((prev) => prev.map((m) => ({ ...m, isAssigned: false, canEdit: false })))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const assignments = members
        .filter((m) => m.isAssigned)
        .map((m) => ({ profile_id: m.id, can_edit: m.canEdit }))

      const res = await fetch(`/api/locations/${locationId}/binders/${binderId}/assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error?.message || "Failed to save assignments")
        return
      }

      toast.success("Assignments saved successfully")
      setHasChanges(false)
    } catch (error) {
      console.error("Failed to save assignments:", error)
      toast.error("Failed to save assignments")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const assignedCount = members.filter((m) => m.isAssigned).length
  const ownerAdminMembers = members.filter((m) => m.role === "owner" || m.role === "admin")
  const otherMembers = members.filter((m) => m.role !== "owner" && m.role !== "admin")

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Owner and Admin users always have full access to all binders and do not need to be assigned.
            Use assignments to grant access to Staff and Inspector users.
          </p>
        </CardContent>
      </Card>

      {/* Actions Bar */}
      {canEdit && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={saving}
              className="h-8 text-xs"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={saving}
              className="h-8 text-xs"
            >
              Deselect All
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {assignedCount} {assignedCount === 1 ? "member" : "members"} assigned
          </div>
        </div>
      )}

      {/* Owner/Admin Section */}
      {ownerAdminMembers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Owners & Admins (Full Access)</h3>
          <div className="space-y-2">
            {ownerAdminMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{member.full_name}</span>
                    <Badge
                      variant="outline"
                      className={roleColors[member.role] || "bg-gray-100 text-gray-700"}
                    >
                      {roleLabels[member.role] || member.role}
                    </Badge>
                  </div>
                  {member.email && (
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Always has access</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Members Section */}
      {otherMembers.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Team Members</h3>
          <div className="space-y-2">
            {otherMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{member.full_name}</span>
                    <Badge
                      variant="outline"
                      className={roleColors[member.role] || "bg-gray-100 text-gray-700"}
                    >
                      {roleLabels[member.role] || member.role}
                    </Badge>
                  </div>
                  {member.email && (
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Assigned Toggle */}
                  <div className="flex items-center gap-2">
                    <label htmlFor={`assigned-${member.id}`} className="text-xs text-muted-foreground">
                      Assigned
                    </label>
                    <Switch
                      id={`assigned-${member.id}`}
                      checked={member.isAssigned}
                      onCheckedChange={() => toggleAssignment(member.id)}
                      disabled={!canEdit || saving}
                    />
                  </div>

                  {/* Can Edit Toggle */}
                  {member.isAssigned && (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={member.canEdit ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {member.canEdit ? "Editor" : "Viewer"}
                      </Badge>
                      <Switch
                        id={`can-edit-${member.id}`}
                        checked={member.canEdit}
                        onCheckedChange={() => toggleCanEdit(member.id)}
                        disabled={!canEdit || saving}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-16">
          <Users className="mb-3 size-8 text-muted-foreground/60" />
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            No team members to assign
          </p>
          <p className="text-xs text-muted-foreground">
            Add team members in Settings to assign them to binders
          </p>
        </div>
      )}

      {/* Save Button */}
      {canEdit && otherMembers.length > 0 && (
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
