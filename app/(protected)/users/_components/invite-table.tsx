"use client"

import { Clock, Mail, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Role } from "@/lib/permissions"

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

interface InviteTableProps {
  invites: InviteCode[]
  onRevoke: (invite: InviteCode) => void
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  owner: {
    label: "Owner",
    className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  },
  admin: {
    label: "Admin",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  },
  nurse: {
    label: "Staff",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  },
  inspector: {
    label: "Inspector",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  },
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const isExpired = (expiresAt: string) => new Date(expiresAt) <= new Date()

export function InviteTable({ invites, onRevoke }: InviteTableProps) {
  const activeInvites = invites.filter((inv) => !inv.consumed_at && new Date(inv.expires_at) > new Date())
  const expiredOrUsedInvites = invites.filter((inv) => inv.consumed_at || new Date(inv.expires_at) <= new Date())

  return (
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
                          onClick={() => onRevoke(invite)}
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
  )
}
