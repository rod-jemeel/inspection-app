"use client"

import { Edit2, MoreHorizontal, Settings, UserMinus, Key } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

interface MemberTableProps {
  members: TeamMember[]
  currentProfileId: string
  canEdit: boolean
  onManage: (member: TeamMember) => void
  onEdit: (member: TeamMember) => void
  onRemove: (member: TeamMember) => void
  onReset: (member: TeamMember) => void
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

export function MemberTable({
  members,
  currentProfileId,
  canEdit,
  onManage,
  onEdit,
  onRemove,
  onReset,
}: MemberTableProps) {
  return (
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
          {members.map((member) => {
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
                          <DropdownMenuItem onClick={() => onManage(member)} className="text-xs">
                            <Settings className="mr-2 size-3.5" />
                            Manage Permissions
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(member)} className="text-xs">
                            <Edit2 className="mr-2 size-3.5" />
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onReset(member)} className="text-xs">
                            <Key className="mr-2 size-3.5" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onRemove(member)}
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
  )
}

export { ROLE_CONFIG }
