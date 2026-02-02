"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  UserPlus,
  Key,
  Check,
  Copy,
  X,
  Edit2,
  UserMinus,
  MoreHorizontal,
  Users,
  Trash2,
  Clock,
  Mail,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

interface TeamMember {
  id: string
  user_id: string
  full_name: string
  email: string | null
  username: string | null
  role: "owner" | "admin" | "nurse" | "inspector"
  created_at: string
}

interface InviteCode {
  id: string
  code_hash: string
  expires_at: string
  max_uses: number
  uses: number
  role_grant: "owner" | "admin" | "nurse" | "inspector"
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

const ROLE_CONFIG: Record<string, { label: string; className: string; description: string }> = {
  owner: {
    label: "Owner",
    className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
    description: "Full access to all features and settings",
  },
  admin: {
    label: "Admin",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
    description: "Can manage templates, inspections, and team",
  },
  nurse: {
    label: "Staff",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300",
    description: "Can view and perform inspections",
  },
  inspector: {
    label: "Inspector",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
    description: "Can perform assigned inspections only",
  },
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
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "admin" | "nurse" | "inspector">("all")

  // Dialogs
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [revokingInvite, setRevokingInvite] = useState<InviteCode | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null)
  const [newRole, setNewRole] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Banners
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    username: string
    password: string
    fullName: string
  } | null>(null)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
        const roleOrder = { owner: 0, admin: 1, nurse: 2, inspector: 3 }
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
  const expiredOrUsedInvites = filteredInvites.filter((inv) => inv.consumed_at || new Date(inv.expires_at) <= new Date())

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) <= new Date()

  return (
    <div className="space-y-4">
      {/* Generated Credentials Banner */}
      {generatedCredentials && (
        <div className="flex items-center gap-3 rounded-md border-2 border-green-500 bg-green-500/5 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green-500/10">
            <UserPlus className="size-5 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted-foreground">
              Member Created: {generatedCredentials.fullName}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <div>
                <span className="text-[11px] text-muted-foreground">Username: </span>
                <code className="text-sm font-mono font-semibold">{generatedCredentials.username}</code>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Password: </span>
                <code className="text-sm font-mono font-semibold">{generatedCredentials.password}</code>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Share these credentials. They'll be prompted to change their password.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(`Username: ${generatedCredentials.username}\nPassword: ${generatedCredentials.password}`)}
              className="gap-1.5"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setGeneratedCredentials(null)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Generated Invite Code Banner */}
      {generatedCode && (
        <div className="flex items-center gap-3 rounded-md border-2 border-primary bg-primary/5 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Key className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted-foreground">Invite Code Generated</div>
            <code className="text-base font-mono font-semibold tracking-widest">{generatedCode}</code>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedCode)} className="gap-1.5">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setGeneratedCode(null)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

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
            <div className="rounded-md border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Email / Username</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    {canEdit && <TableHead className="w-12 text-xs" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => {
                    const roleConfig = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.inspector
                    const isCurrentUser = member.id === currentProfileId
                    const canManage = canEdit && !isCurrentUser && member.role !== "owner"

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-medium uppercase">
                              {member.full_name.charAt(0)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium">{member.full_name}</span>
                              {isCurrentUser && (
                                <Badge variant="outline" className="text-[9px]">You</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {member.email || member.username || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]", roleConfig.className)}>
                            {roleConfig.label}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => handleEditMember(member)} className="text-xs">
                                    <Edit2 className="mr-2 size-3.5" />
                                    Change Role
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setRemovingMember(member)}
                                    className="text-xs text-destructive focus:text-destructive"
                                  >
                                    <UserMinus className="mr-2 size-3.5" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
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
            <div className="space-y-6">
              {/* Active Invites */}
              {activeInvites.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">Active Invites</h3>
                  <div className="rounded-md border bg-card shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                          <TableHead className="text-xs">Expires</TableHead>
                          <TableHead className="text-xs">Uses</TableHead>
                          <TableHead className="w-12 text-xs" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeInvites.map((invite) => {
                          const roleConfig = ROLE_CONFIG[invite.role_grant] ?? ROLE_CONFIG.inspector

                          return (
                            <TableRow key={invite.id}>
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2">
                                  <Mail className="size-3.5 text-muted-foreground" />
                                  <span className="text-xs">{invite.assigned_email || "Any email"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px]", roleConfig.className)}>
                                  {roleConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {formatDate(invite.expires_at)}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                {invite.uses} / {invite.max_uses}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => setRevokingInvite(invite)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Expired/Used Invites */}
              {expiredOrUsedInvites.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">Expired / Used</h3>
                  <div className="rounded-md border bg-card shadow-sm opacity-60">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Uses</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expiredOrUsedInvites.map((invite) => {
                          const roleConfig = ROLE_CONFIG[invite.role_grant] ?? ROLE_CONFIG.inspector
                          const expired = isExpired(invite.expires_at)

                          return (
                            <TableRow key={invite.id}>
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2">
                                  <Mail className="size-3.5 text-muted-foreground" />
                                  <span className="text-xs">{invite.assigned_email || "Any email"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px]", roleConfig.className)}>
                                  {roleConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {invite.consumed_at ? (
                                  <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-200">
                                    Used
                                  </Badge>
                                ) : expired ? (
                                  <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">
                                    Expired
                                  </Badge>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-xs">
                                {invite.uses} / {invite.max_uses}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
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
                  <SelectItem value="admin" className="text-xs">
                    <div>
                      <div className="font-medium">Admin</div>
                      <div className="text-muted-foreground">{ROLE_CONFIG.admin.description}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="nurse" className="text-xs">
                    <div>
                      <div className="font-medium">Staff</div>
                      <div className="text-muted-foreground">{ROLE_CONFIG.nurse.description}</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="inspector" className="text-xs">
                    <div>
                      <div className="font-medium">Inspector</div>
                      <div className="text-muted-foreground">{ROLE_CONFIG.inspector.description}</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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
    </div>
  )
}
