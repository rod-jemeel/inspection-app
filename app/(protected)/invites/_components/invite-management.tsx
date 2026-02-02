"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Key, Copy, Clock, Check, X, Mail, Hash, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"

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

type InviteStatus = "active" | "expired" | "consumed"

const STATUS_CONFIG: Record<InviteStatus, { label: string; variant: string; className?: string }> = {
  active: { label: "Active", variant: "default" },
  expired: { label: "Expired", variant: "outline", className: "opacity-50" },
  consumed: { label: "Consumed", variant: "secondary" },
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300" },
  admin: { label: "Admin", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" },
  nurse: { label: "Staff", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300" },
  inspector: { label: "Inspector", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300" },
}

// Date formatter using Intl for i18n
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
})

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

export function InviteManagement({
  invites: initialInvites,
  locationId,
}: {
  invites: InviteCode[]
  locationId: string
}) {
  const router = useRouter()
  const [invites, setInvites] = useState(initialInvites)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<InviteStatus | "all">("all")

  // Form state
  const [email, setEmail] = useState("")
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [maxUses, setMaxUses] = useState(1)

  const resetForm = useCallback(() => {
    setEmail("")
    setExpiresInDays(7)
    setMaxUses(1)
    setError(null)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const body = {
        assigned_email: email,
        expires_in_days: expiresInDays,
        max_uses: maxUses,
      }

      const res = await fetch(`/api/locations/${locationId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error?.message ?? "Something went wrong")
        return
      }

      const { data, code } = await res.json()
      setInvites((prev) => [data, ...prev])
      setGeneratedCode(code)
      setDialogOpen(false)
      resetForm()
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text if clipboard API fails
    }
  }

  const isExpired = (dateString: string) => new Date(dateString) < new Date()

  const getStatus = useCallback((invite: InviteCode): InviteStatus => {
    if (invite.consumed_at) return "consumed"
    if (isExpired(invite.expires_at)) return "expired"
    return "active"
  }, [])

  const formatDate = (dateString: string) => dateFormatter.format(new Date(dateString))
  const formatShortDate = (dateString: string) => shortDateFormatter.format(new Date(dateString))

  // Filter and group invites
  const filteredInvites = useMemo(() => {
    return invites.filter((invite) => {
      const status = getStatus(invite)
      if (statusFilter !== "all" && status !== statusFilter) return false
      if (search) {
        const query = search.toLowerCase()
        return invite.assigned_email?.toLowerCase().includes(query)
      }
      return true
    })
  }, [invites, search, statusFilter, getStatus])

  const groupedInvites = useMemo(() => {
    const groups: Record<InviteStatus, InviteCode[]> = {
      active: [],
      expired: [],
      consumed: [],
    }
    for (const invite of filteredInvites) {
      const status = getStatus(invite)
      groups[status].push(invite)
    }
    return groups
  }, [filteredInvites, getStatus])

  const renderInviteCard = useCallback(
    (invite: InviteCode) => {
      const status = getStatus(invite)
      const config = STATUS_CONFIG[status]
      const roleConfig = ROLE_CONFIG[invite.role_grant] ?? ROLE_CONFIG.inspector

      return (
        <div
          key={invite.id}
          className={cn(
            "group flex w-full items-center gap-3 rounded-md border bg-card p-3 shadow-sm transition-all",
            status === "expired" && "opacity-60"
          )}
        >
          {/* Icon */}
          <div className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            status === "active" && "bg-primary/10",
            status === "consumed" && "bg-green-500/10",
            status === "expired" && "bg-muted"
          )}>
            {status === "consumed" ? (
              <Check className="size-4 text-green-600" />
            ) : (
              <Key className={cn("size-4", status === "active" ? "text-primary" : "text-muted-foreground")} />
            )}
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium">
                {invite.assigned_email || "No email assigned"}
              </span>
            </div>
            <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
              <span className={cn(status === "expired" && "text-destructive")}>
                {status === "expired" ? "Expired" : "Expires"} {formatShortDate(invite.expires_at)}
              </span>
              <span className="hidden sm:inline">·</span>
              <span>
                {invite.uses}/{invite.max_uses} uses
              </span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-[10px]", roleConfig.className)}
            >
              {roleConfig.label}
            </Badge>
            <Badge
              variant={config.variant as "outline" | "secondary" | "default"}
              className={cn("text-[10px] capitalize", config.className)}
            >
              {config.label}
            </Badge>
          </div>
        </div>
      )
    },
    [getStatus]
  )

  const renderSection = (
    title: string,
    items: InviteCode[],
    defaultOpen: boolean = true,
    headerClassName?: string
  ) => {
    if (items.length === 0) return null

    return (
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted">
          <ChevronRight className="size-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
          <span className={cn("text-xs font-medium", headerClassName)}>{title}</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {items.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-1 gap-2 pb-4 pt-2">
            {items.map(renderInviteCard)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const STATUS_TABS = [
    { value: "all" as const, label: "All" },
    { value: "active" as const, label: "Active" },
    { value: "expired" as const, label: "Expired" },
    { value: "consumed" as const, label: "Consumed" },
  ]

  return (
    <div className="space-y-4">
      {/* Generated Code Banner */}
      {generatedCode && (
        <div className="flex items-center gap-3 rounded-md border-2 border-primary bg-primary/5 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Key className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">New Invite Code Generated</div>
            <code className="text-sm font-mono font-semibold tracking-wider">{generatedCode}</code>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(generatedCode)}
              className="gap-1.5"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setGeneratedCode(null)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* New button */}
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="size-4 sm:size-3.5" />
          <span className="hidden sm:inline">Generate Code</span>
        </Button>
      </div>

      {/* Invite List */}
      {invites.length === 0 ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          No invite codes yet. Generate your first code to invite inspectors.
        </div>
      ) : filteredInvites.length === 0 ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          No invites match your search.
        </div>
      ) : statusFilter === "all" ? (
        <div className="space-y-2">
          {renderSection("Active", groupedInvites.active, true)}
          {renderSection("Consumed", groupedInvites.consumed, false)}
          {renderSection("Expired", groupedInvites.expired, false, "text-muted-foreground")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filteredInvites.map(renderInviteCard)}
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Invite Code</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field>
              <FieldLabel>Email Address</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="inspector@example.com"
                  required
                  disabled={loading}
                  autoComplete="email"
                  className="pl-8"
                />
              </div>
              <FieldDescription>
                The inspector will use this email to register
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Expires In</FieldLabel>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    min={1}
                    max={30}
                    required
                    disabled={loading}
                    autoComplete="off"
                    className="pl-8"
                  />
                </div>
                <FieldDescription>Days</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Max Uses</FieldLabel>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    min={1}
                    max={10}
                    required
                    disabled={loading}
                    autoComplete="off"
                    className="pl-8"
                  />
                </div>
                <FieldDescription>Times</FieldDescription>
              </Field>
            </div>

            {error && <FieldError>{error}</FieldError>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}
                disabled={loading}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
