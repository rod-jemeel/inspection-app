"use client"

import {
  Home,
  ClipboardList,
  ClipboardCheck,
  Key,
  Settings,
} from "lucide-react"

import { LocationSwitcher } from "@/components/location-switcher"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string
    email: string | null
    role: "owner" | "admin" | "nurse" | "inspector"
  }
  locations: { id: string; name: string }[]
  currentLocationId: string | null
  onLocationChange: (id: string) => void
  onSignOut: () => void
}

export function AppSidebar({
  user,
  locations,
  currentLocationId,
  onLocationChange,
  onSignOut,
  ...props
}: AppSidebarProps) {
  const navItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Templates", url: "/templates", icon: ClipboardList },
    { title: "Inspections", url: "/inspections", icon: ClipboardCheck },
    ...(user.role === "admin" || user.role === "owner"
      ? [{ title: "Invites", url: "/invites", icon: Key }]
      : []),
    { title: "Settings", url: "/settings", icon: Settings },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LocationSwitcher
          locations={locations}
          currentLocationId={currentLocationId}
          onLocationChange={onLocationChange}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} locationId={currentLocationId} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} locationId={currentLocationId} onSignOut={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
