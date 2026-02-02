"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Mail, Clock, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"

interface InviteDialogProps {
  locationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (code: string) => void
}

export function InviteDialog({ locationId, open, onOpenChange, onSuccess }: InviteDialogProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [expiresDays, setExpiresDays] = useState(7)
  const [maxUses, setMaxUses] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setEmail("")
    setExpiresDays(7)
    setMaxUses(1)
    setError(null)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/locations/${locationId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_email: email,
          expires_in_days: expiresDays,
          max_uses: maxUses,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error?.message ?? "Failed to generate invite")
        return
      }

      const { code } = await res.json()
      onSuccess(code)
      onOpenChange(false)
      resetForm()
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Inspector</DialogTitle>
          <DialogDescription>
            Generate an invite code for a new inspector to join this location.
          </DialogDescription>
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
            <FieldDescription>The inspector will use this email to register</FieldDescription>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Expires In</FieldLabel>
              <div className="relative">
                <Clock className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(Number(e.target.value))}
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
                onOpenChange(false)
                resetForm()
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Generating..." : "Generate Code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
