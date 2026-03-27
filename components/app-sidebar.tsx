"use client"

import {
  Home,
  ClipboardCheck,
  Users,
  Settings,
  HelpCircle,
  Lightbulb,
} from "lucide-react"
import Link from "next/link"

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
  useSidebar,
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
  binders?: { id: string; name: string; color: string | null; icon: string | null }[]
  pendingCount?: number
}

function HelpTip() {
  const { state } = useSidebar()
  if (state === "collapsed") return null

  return (
    <div className="mt-auto px-3 pb-2">
      <Link
        href="/help"
        className="flex items-start gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
        <span>Have questions? Visit the <span className="font-medium text-sidebar-foreground">Help Guide</span> for walkthroughs and tips.</span>
      </Link>
    </div>
  )
}

export function AppSidebar({
  user,
  locations,
  currentLocationId,
  onLocationChange,
  onSignOut,
  binders = [],
  pendingCount,
  ...props
}: AppSidebarProps) {
  const isAdmin = user.role === "admin" || user.role === "owner"

  const mainItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Inspections", url: "/inspections", icon: ClipboardCheck, badge: pendingCount },
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
        <NavBinders binders={binders} locationId={currentLocationId} isAdmin={isAdmin} />
        <NavMain items={adminItems} locationId={currentLocationId} label={isAdmin ? "Admin" : "Account"} />
        <NavMain items={helpItems} locationId={currentLocationId} label="Support" />
        <HelpTip />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} locationId={currentLocationId} onSignOut={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
