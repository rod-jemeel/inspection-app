"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Edit2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { TIMEZONES } from "@/lib/validations/location"

interface Location {
  id: string
  name: string
  address: string | null
  timezone: string
  active: boolean
}

interface LocationCardProps {
  location: Location
  canEdit: boolean
  isOwner: boolean
}

const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern Time (ET)",
  "America/Chicago": "Central Time (CT)",
  "America/Denver": "Mountain Time (MT)",
  "America/Los_Angeles": "Pacific Time (PT)",
  "America/Phoenix": "Arizona (MST)",
  "America/Anchorage": "Alaska Time (AKT)",
  "Pacific/Honolulu": "Hawaii Time (HST)",
}

export function LocationCard({ location, canEdit, isOwner }: LocationCardProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(location.name)
  const [address, setAddress] = useState(location.address ?? "")
  const [timezone, setTimezone] = useState(location.timezone)
  const [active, setActive] = useState(location.active)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: address || null,
          timezone,
          active,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error?.message ?? "Failed to save")
        return
      }

      setEditing(false)
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setName(location.name)
    setAddress(location.address ?? "")
    setTimezone(location.timezone)
    setActive(location.active)
    setError(null)
    setEditing(false)
  }

  return (
    <section className="space-y-5">
      {editing ? (
        <div className="space-y-4">
          <Field>
            <FieldLabel>Location Name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Building"
              disabled={loading}
              className="h-8 text-xs"
            />
          </Field>

          <Field>
            <FieldLabel>Address</FieldLabel>
            <div className="relative">
              <Building2 className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, City, State 12345"
                disabled={loading}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <FieldDescription>Physical address of this location</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Timezone</FieldLabel>
            <Select
              value={timezone}
              onValueChange={(value) => value && setTimezone(value)}
              disabled={loading}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz} className="text-xs">
                    {TIMEZONE_LABELS[tz] || tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Used for scheduling and due dates</FieldDescription>
          </Field>

          {isOwner ? (
            <Field>
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="space-y-0.5">
                  <FieldLabel className="mb-0">Active</FieldLabel>
                  <FieldDescription className="mt-0">
                    Inactive locations will stop generating inspections
                  </FieldDescription>
                </div>
                <Switch checked={active} onCheckedChange={setActive} disabled={loading} />
              </div>
            </Field>
          ) : null}

          {error ? <FieldError>{error}</FieldError> : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 border-t border-border/70 pt-5">
          <dl className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Name
              </dt>
              <dd className="text-sm font-medium text-foreground">{location.name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Status
              </dt>
              <dd>
                <Badge variant={location.active ? "default" : "secondary"} className="text-[10px]">
                  {location.active ? "Active" : "Inactive"}
                </Badge>
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Address
              </dt>
              <dd className="text-sm text-foreground">{location.address || "Not provided"}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Timezone
              </dt>
              <dd className="text-sm text-foreground">
                {TIMEZONE_LABELS[location.timezone] || location.timezone}
              </dd>
            </div>
          </dl>

          {canEdit ? (
            <div className="flex justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="gap-1.5"
              >
                <Edit2 className="size-3.5" />
                Edit
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
