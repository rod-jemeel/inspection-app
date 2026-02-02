"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, MapPin, Check, Plus, Building2 } from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
]

interface LocationSwitcherProps {
  locations: { id: string; name: string }[]
  currentLocationId: string | null
  onLocationChange: (id: string) => void
  canAddLocation?: boolean
}

export function LocationSwitcher({
  locations,
  currentLocationId,
  onLocationChange,
  canAddLocation = false,
}: LocationSwitcherProps) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const currentLocation = locations.find((loc) => loc.id === currentLocationId) ?? locations[0]

  // Dropdown and dialog state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [timezone, setTimezone] = useState("America/New_York")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: address || null, timezone }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error?.message ?? "Failed to create location")
        return
      }

      const { data } = await res.json()
      setDialogOpen(false)
      setName("")
      setAddress("")
      setTimezone("America/New_York")
      onLocationChange(data.id)
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!currentLocation) {
    return null
  }

  const trigger = (
    <SidebarMenuButton
      size="lg"
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shrink-0">
        <MapPin className="size-4" />
      </div>
      <div className="grid flex-1 text-left leading-tight min-w-0">
        <span className="truncate text-sm font-semibold">{currentLocation.name}</span>
        <span className="truncate text-xs text-muted-foreground">Location</span>
      </div>
      <ChevronsUpDown className="ml-auto size-4 shrink-0" />
    </SidebarMenuButton>
  )

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  {trigger}
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                align="center"
                hidden={dropdownOpen || isMobile}
              >
                {currentLocation.name}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              className="min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Locations
              </DropdownMenuLabel>
              {locations.map((location) => (
                <DropdownMenuItem
                  key={location.id}
                  onClick={() => onLocationChange(location.id)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border border-current/20 shrink-0">
                    <MapPin className="size-3.5 shrink-0 text-current" />
                  </div>
                  <span className="flex-1">{location.name}</span>
                  {location.id === currentLocationId && <Check className="size-4 shrink-0 text-current" />}
                </DropdownMenuItem>
              ))}
              {canAddLocation && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDialogOpen(true)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border border-dashed border-current/30 shrink-0">
                      <Plus className="size-3.5 shrink-0 text-current" />
                    </div>
                    <span className="flex-1">Add Location</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Add Location Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
            <DialogDescription>
              Create a new location for your organization.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLocation} className="space-y-4">
            <Field>
              <FieldLabel>Location Name</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Main Building"
                required
                disabled={loading}
                className="h-8 text-xs"
              />
            </Field>

            <Field>
              <FieldLabel>Address <span className="text-muted-foreground">(optional)</span></FieldLabel>
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
            </Field>

            <Field>
              <FieldLabel>Timezone</FieldLabel>
              <Select
                value={timezone}
                onValueChange={(v) => v && setTimezone(v)}
                disabled={loading}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value} className="text-xs">
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Used for scheduling and due dates</FieldDescription>
            </Field>

            {error && <FieldError>{error}</FieldError>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading || !name}>
                {loading ? "Creating..." : "Create Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
