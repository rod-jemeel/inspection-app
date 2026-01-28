"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  House,
  ClipboardText,
  ListChecks,
  Key,
  GearSix,
  SignOut,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { LocationSelector } from "./location-selector"
import { signOut } from "@/lib/auth-client"

interface AppShellProps {
  user: {
    name: string
    email: string | null
    role: "owner" | "admin" | "nurse" | "inspector"
  }
  locations: { id: string; name: string }[]
  children: React.ReactNode
  mustChangePassword?: boolean
}

export function AppShell({ user, locations, children, mustChangePassword }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Redirect to change-password if required (except if already on that page)
  useEffect(() => {
    if (mustChangePassword && pathname !== "/change-password") {
      router.push("/change-password")
    }
  }, [mustChangePassword, pathname, router])

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const navLinks = [
    { href: "/dashboard", icon: House, label: "Dashboard" },
    { href: "/templates", icon: ClipboardText, label: "Templates" },
    { href: "/inspections", icon: ListChecks, label: "Inspections" },
    ...(user.role === "admin" || user.role === "owner"
      ? [{ href: "/invites", icon: Key, label: "Invites" }]
      : []),
    { href: "/settings", icon: GearSix, label: "Settings" },
  ]

  const roleVariant: Record<string, "default" | "secondary" | "outline"> = {
    owner: "default",
    admin: "secondary",
    nurse: "outline",
    inspector: "outline",
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex h-8 items-center px-2">
            <span className="text-sm font-medium">Inspection Tracker</span>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <LocationSelector locations={locations} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navLinks.map((link) => {
                  const isActive = pathname === link.href
                  const Icon = link.icon

                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={link.label}
                        render={<Link href={link.href} />}
                      >
                        <Icon weight={isActive ? "bold" : "regular"} />
                        <span>{link.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter>
          <div className="space-y-2 px-2">
            <div className="space-y-1">
              <div className="text-xs font-medium">{user.name}</div>
              {user.email && (
                <div className="text-xs text-muted-foreground">{user.email}</div>
              )}
              <Badge
                variant={roleVariant[user.role] ?? "outline"}
                className="mt-1 capitalize"
              >
                {user.role}
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start gap-2"
            >
              <SignOut weight="regular" className="size-3.5" />
              Sign out
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Mobile header with trigger */}
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-medium">Inspection Tracker</span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
