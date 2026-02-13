"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  UserPlus,
  Key,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { AddMemberDialog } from "@/app/(protected)/settings/_components/add-member-dialog"
import { InviteDialog } from "@/app/(protected)/settings/_components/invite-dialog"
import { MemberDetailDialog } from "./member-detail-dialog"
import { MemberTable, ROLE_CONFIG } from "./member-table"
import { InviteTable } from "./invite-table"
import { MemberActionsBanner } from "./member-actions-banner"
import type { Role } from "@/lib/permissions"

interface TeamMember {
  id: string
  user_id: string
  full_name: string
  email: string | null
  username: string | null
  role: Role
  created_at: string
  can_manage_binders: boolean
  can_manage_forms: boolean
  can_view_all_responses: boolean
  can_export_reports: boolean
  can_configure_integrations: boolean
}

interface InviteCode {
  id: string
  code_hash: string
  expires_at: string
  max_uses: number
  uses: number
  role_grant: Role
  location_id: string
  assigned_email: string | null
  created_by: string
  created_at: string
  consumed_at: string | null
}

interface UsersContentProps {
  locationId: string
  teamMembers: TeamMember[]
  invites: InviteCode[]
  currentProfileId: string
  canEdit: boolean
}

interface ResetPasswordResult {
  tempPassword: string
  fullName: string
}

const ROLE_TABS = [
  { value: "all" as const, label: "All" },
  { value: "owner" as const, label: "Owners" },
  { value: "admin" as const, label: "Admins" },
  { value: "nurse" as const, label: "Staff" },
  { value: "inspector" as const, label: "Inspectors" },
]

const MAIN_TABS = [
  { value: "members" as const, label: "Members" },
  { value: "invites" as const, label: "Invites" },
]

export function UsersContent({
  locationId,
  teamMembers,
  invites,
  currentProfileId,
  canEdit,
}: UsersContentProps) {
  const router = useRouter()
  const [mainTab, setMainTab] = useState<"members" | "invites">("members")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all")

  // Dialogs
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [revokingInvite, setRevokingInvite] = useState<InviteCode | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [managingMember, setManagingMember] = useState<TeamMember | null>(null)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null)
  const [resettingMember, setResettingMember] = useState<TeamMember | null>(null)
  const [newRole, setNewRole] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Banners
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    username: string
    password: string
    fullName: string
  } | null>(null)
  const [resetPasswordResult, setResetPasswordResult] = useState<ResetPasswordResult | null>(null)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  const filteredMembers = useMemo(() => {
    return teamMembers
      .filter((m) => {
        if (roleFilter !== "all" && m.role !== roleFilter) return false
        if (search) {
          const query = search.toLowerCase()
          return (
            m.full_name.toLowerCase().includes(query) ||
            m.email?.toLowerCase().includes(query) ||
            m.username?.toLowerCase().includes(query)
          )
        }
        return true
      })
      .sort((a, b) => {
        const roleOrder: Record<string, number> = { owner: 0, admin: 1, nurse: 2, inspector: 3 }
        const aOrder = roleOrder[a.role] ?? 4
        const bOrder = roleOrder[b.role] ?? 4
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.full_name.localeCompare(b.full_name)
      })
  }, [teamMembers, search, roleFilter])

  const filteredInvites = useMemo(() => {
    if (!search) return invites
    const query = search.toLowerCase()
    return invites.filter((inv) => inv.assigned_email?.toLowerCase().includes(query))
  }, [invites, search])

  const activeInvites = filteredInvites.filter((inv) => !inv.consumed_at && new Date(inv.expires_at) > new Date())

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member)
    setNewRole(member.role)
    setError(null)
  }

  const handleSaveRole = async () => {
    if (!editingMember) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/locations/${locationId}/members/${editingMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error?.message ?? "Failed to update role")
        return
      }

      setEditingMember(null)
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!removingMember) return
    setLoading(true)

    try {
      const res = await fetch(`/api/locations/${locationId}/members/${removingMember.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setRemovingMember(null)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resettingMember) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/users/${resettingMember.user_id}/reset-password`, {
        method: "POST",
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? "Failed to reset password")
        return
      }

      const data = await res.json()
      setResetPasswordResult({
        tempPassword: data.tempPassword,
        fullName: resettingMember.full_name,
      })
      setResettingMember(null)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeInvite = async () => {
    if (!revokingInvite) return
    setLoading(true)

    try {
      const res = await fetch(`/api/locations/${locationId}/invites/${revokingInvite.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setRevokingInvite(null)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Banners */}
      <MemberActionsBanner
        generatedCredentials={generatedCredentials}
        resetPasswordResult={resetPasswordResult}
        generatedCode={generatedCode}
        onDismissCredentials={() => setGeneratedCredentials(null)}
        onDismissReset={() => setResetPasswordResult(null)}
        onDismissCode={() => setGeneratedCode(null)}
      />

      {/* Main Tabs */}
      {canEdit && (
        <div className="flex gap-1 border-b">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setMainTab(tab.value)}
              className={cn(
                "px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
                mainTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.value === "invites" && activeInvites.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[9px] px-1.5">
                  {activeInvites.length}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={mainTab === "members" ? "Search by name or email..." : "Search by email..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Role filter tabs - only for members */}
        {mainTab === "members" && (
          <div className="flex flex-wrap gap-1.5">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setRoleFilter(tab.value)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  roleFilter === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <UserPlus className="size-3.5" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setAddMemberOpen(true)} className="text-xs">
                <UserPlus className="mr-2 size-3.5" />
                Member
                <span className="ml-auto text-[10px] opacity-60">Staff/Admin</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setInviteOpen(true)} className="text-xs">
                <Key className="mr-2 size-3.5" />
                Inspector
                <span className="ml-auto text-[10px] opacity-60">Invite Code</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Members Tab Content */}
      {mainTab === "members" && (
        <>
          {teamMembers.length === 0 ? (
            <div className="py-20 text-center">
              <Users className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">No team members yet</p>
              {canEdit && (
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="sm" onClick={() => setAddMemberOpen(true)} className="gap-1.5">
                    <UserPlus className="size-3.5" />
                    Add Member
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} className="gap-1.5">
                    <Key className="size-3.5" />
                    Invite Inspector
                  </Button>
                </div>
              )}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-20 text-center text-xs text-muted-foreground">
              No members match your search.
            </div>
          ) : (
            <MemberTable
              members={filteredMembers}
              currentProfileId={currentProfileId}
              canEdit={canEdit}
              onManage={setManagingMember}
              onEdit={handleEditMember}
              onRemove={setRemovingMember}
              onReset={setResettingMember}
            />
          )}
        </>
      )}

      {/* Invites Tab Content */}
      {mainTab === "invites" && canEdit && (
        <>
          {invites.length === 0 ? (
            <div className="py-20 text-center">
              <Key className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">No invite codes yet</p>
              <Button size="sm" onClick={() => setInviteOpen(true)} className="mt-3 gap-1.5">
                <Key className="size-3.5" />
                Create Invite
              </Button>
            </div>
          ) : filteredInvites.length === 0 ? (
            <div className="py-20 text-center text-xs text-muted-foreground">
              No invites match your search.
            </div>
          ) : (
            <InviteTable invites={filteredInvites} onRevoke={setRevokingInvite} />
          )}
        </>
      )}

      {/* Dialogs */}
      <AddMemberDialog
        locationId={locationId}
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        onSuccess={setGeneratedCredentials}
      />

      <InviteDialog
        locationId={locationId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={setGeneratedCode}
      />

      <MemberDetailDialog
        member={managingMember}
        locationId={locationId}
        open={!!managingMember}
        onOpenChange={(open) => { if (!open) setManagingMember(null) }}
        onSuccess={() => { setManagingMember(null); router.refresh() }}
        canEdit={canEdit}
      />

      {/* Edit Role Dialog */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Update the role for {editingMember?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select value={newRole} onValueChange={(value) => value && setNewRole(value)} disabled={loading}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                  <SelectItem value="nurse" className="text-xs">Staff</SelectItem>
                  <SelectItem value="inspector" className="text-xs">Inspector</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                {newRole && ROLE_CONFIG[newRole]?.description}
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditingMember(null)} disabled={loading}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveRole} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removingMember?.full_name} from this location?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invite Confirmation */}
      <AlertDialog open={!!revokingInvite} onOpenChange={() => setRevokingInvite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invite</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invite code? It will no longer be usable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeInvite}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Confirmation */}
      <AlertDialog open={!!resettingMember} onOpenChange={() => setResettingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new temporary password for {resettingMember?.full_name}.
              They will be required to change it on their next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="text-xs text-destructive">{error}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
