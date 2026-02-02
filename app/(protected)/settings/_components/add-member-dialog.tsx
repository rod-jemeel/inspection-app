"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { User, Mail } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"

interface AddMemberDialogProps {
  locationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (credentials: { username: string; password: string; fullName: string }) => void
}

const ROLE_CONFIG = {
  admin: { description: "Can manage templates, inspections, and team" },
  nurse: { description: "Can view and perform inspections" },
}

export function AddMemberDialog({ locationId, open, onOpenChange, onSuccess }: AddMemberDialogProps) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "nurse">("nurse")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setUsername("")
    setFullName("")
    setEmail("")
    setRole("nurse")
    setError(null)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: email || undefined,
          fullName,
          role,
          locationIds: [locationId],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? "Failed to create user")
        return
      }

      const { tempPassword } = await res.json()
      onSuccess({ username, password: tempPassword, fullName })
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
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Create a new staff or admin account with username and password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel>Full Name</FieldLabel>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
              disabled={loading}
              className="h-8 text-xs"
            />
          </Field>

          <Field>
            <FieldLabel>Username</FieldLabel>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="johndoe"
                required
                disabled={loading}
                className="pl-8"
              />
            </div>
            <FieldDescription>Letters, numbers, and underscores only</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>
              Email <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                disabled={loading}
                className="pl-8"
              />
            </div>
            <FieldDescription>If provided, a welcome email will be sent</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Role</FieldLabel>
            <Select
              value={role}
              onValueChange={(value) => value && setRole(value as "admin" | "nurse")}
              disabled={loading}
            >
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                <SelectItem value="nurse" className="text-xs">Staff</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription className="text-xs">
              {role === "admin" ? ROLE_CONFIG.admin.description : ROLE_CONFIG.nurse.description}
            </FieldDescription>
          </Field>

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
              {loading ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
