"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Key, Copy, Clock, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"

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

export function InviteManagement({
  invites: initialInvites,
  locationId,
}: {
  invites: InviteCode[]
  locationId: string
}) {
  const router = useRouter()
  const [invites, setInvites] = useState(initialInvites)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  // Form state
  const [email, setEmail] = useState("")
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [maxUses, setMaxUses] = useState(1)

  const resetForm = () => {
    setEmail("")
    setExpiresInDays(7)
    setMaxUses(1)
    setShowForm(false)
    setError(null)
  }

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
    } catch {
      // Fallback: select text if clipboard API fails
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date()
  }

  const getStatus = (invite: InviteCode) => {
    if (invite.consumed_at) return "consumed"
    if (isExpired(invite.expires_at)) return "expired"
    return "active"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium">Invite Codes</h1>
        {!showForm && !generatedCode && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus weight="bold" className="size-3.5" />
            Generate Code
          </Button>
        )}
      </div>

      {/* Generated Code Display */}
      {generatedCode && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key weight="bold" className="size-4" />
              New Invite Code Generated
            </CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setGeneratedCode(null)}
              >
                <X weight="bold" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-none bg-muted p-4 text-center">
              <code className="text-sm font-medium tracking-wider font-mono">{generatedCode}</code>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => copyToClipboard(generatedCode)}
              >
                <Copy weight="bold" className="size-3.5" />
                Copy Code
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setGeneratedCode(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Generate New Invite Code</CardTitle>
            <CardAction>
              <Button variant="ghost" size="icon-xs" onClick={resetForm}>
                <X weight="bold" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field>
                <FieldLabel>Email Address</FieldLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="inspector@example.com"
                  required
                  disabled={loading}
                />
              </Field>
              <Field>
                <FieldLabel>Expires in Days</FieldLabel>
                <Input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  min={1}
                  max={30}
                  required
                  disabled={loading}
                />
              </Field>
              <Field>
                <FieldLabel>Max Uses</FieldLabel>
                <Input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  min={1}
                  max={10}
                  required
                  disabled={loading}
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? "Generating..." : "Generate"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {invites.length === 0 ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          No invite codes yet. Generate your first code to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => {
            const status = getStatus(invite)
            return (
              <Card key={invite.id} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 flex-wrap">
                    <span className="truncate">{invite.assigned_email}</span>
                    {status === "active" && (
                      <Badge variant="default">
                        Active
                      </Badge>
                    )}
                    {status === "expired" && (
                      <Badge variant="outline" className="opacity-50">
                        Expired
                      </Badge>
                    )}
                    {status === "consumed" && (
                      <Badge variant="secondary">Consumed</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock weight="bold" className="size-3.5" />
                      <span>Created: {formatDate(invite.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock weight="bold" className="size-3.5" />
                      <span
                        className={cn(
                          isExpired(invite.expires_at) && "text-destructive"
                        )}
                      >
                        Expires: {formatDate(invite.expires_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Key weight="bold" className="size-3.5" />
                      <span>
                        Uses: {invite.uses}/{invite.max_uses}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
