"use client"

import {
  Home,
  ClipboardList,
  ClipboardCheck,
  Users,
  Settings,
  HelpCircle,
} from "lucide-react"

import type { Role } from "@/lib/permissions"
import { LocationSwitcher } from "@/components/location-switcher"
import { NavMain } from "@/components/nav-main"
import { NavBinders } from "@/components/nav-binders"
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
    role: Role
  }
  locations: { id: string; name: string }[]
  currentLocationId: string | null
  onLocationChange: (id: string) => void
  onSignOut: () => void
  binders?: { id: string; name: string; color: string | null }[]
}

export function AppSidebar({
  user,
  locations,
  currentLocationId,
  onLocationChange,
  onSignOut,
  binders = [],
  ...props
}: AppSidebarProps) {
  const isAdmin = user.role === "admin" || user.role === "owner"

  const mainItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Templates", url: "/templates", icon: ClipboardList },
    { title: "Inspections", url: "/inspections", icon: ClipboardCheck },
  ]

  const adminItems = isAdmin
    ? [
        { title: "Team", url: "/users", icon: Users },
        { title: "Settings", url: "/settings", icon: Settings },
      ]
    : [{ title: "Settings", url: "/settings", icon: Settings }]

  const helpItems = [{ title: "Help", url: "/help", icon: HelpCircle }]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LocationSwitcher
          locations={locations}
          currentLocationId={currentLocationId}
          onLocationChange={onLocationChange}
          canAddLocation={isAdmin}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainItems} locationId={currentLocationId} label="Main" />
        <NavBinders binders={binders} locationId={currentLocationId} />
        <NavMain items={adminItems} locationId={currentLocationId} label={isAdmin ? "Admin" : "Account"} />
        <NavMain items={helpItems} locationId={currentLocationId} label="Support" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} locationId={currentLocationId} onSignOut={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
