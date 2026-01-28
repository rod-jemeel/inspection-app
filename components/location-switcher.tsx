"use client"

import { ChevronsUpDown, MapPin, Check } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

interface LocationSwitcherProps {
  locations: { id: string; name: string }[]
  currentLocationId: string | null
  onLocationChange: (id: string) => void
}

export function LocationSwitcher({
  locations,
  currentLocationId,
  onLocationChange,
}: LocationSwitcherProps) {
  const { isMobile, state } = useSidebar()
  const currentLocation = locations.find((loc) => loc.id === currentLocationId) ?? locations[0]

  if (!currentLocation) {
    return null
  }

  const trigger = (
    <SidebarMenuButton
      size="lg"
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
        <MapPin className="size-4" />
      </div>
      <div className="grid flex-1 text-left leading-tight min-w-0">
        <span className="truncate font-semibold">{currentLocation.name}</span>
        <span className="truncate text-xs text-muted-foreground">Location</span>
      </div>
      <ChevronsUpDown className="ml-auto size-4" />
    </SidebarMenuButton>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                {trigger}
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              hidden={state !== "collapsed" || isMobile}
            >
              {currentLocation.name}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
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
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <MapPin className="size-3.5 shrink-0" />
                </div>
                <span className="flex-1 truncate">{location.name}</span>
                {location.id === currentLocationId && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
