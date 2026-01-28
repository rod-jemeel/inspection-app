"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  House,
  ClipboardText,
  ListChecks,
  Key,
  GearSix,
  SignOut,
  List,
  X,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

  const roleVariant: Record<string, string> = {
    owner: "default",
    admin: "secondary",
    nurse: "outline",
    inspector: "outline",
  }

  return (
    <div className="flex min-h-svh bg-background">
      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-12 items-center border-b border-sidebar-border bg-sidebar px-4 md:hidden">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X weight="bold" /> : <List weight="bold" />}
        </Button>
        <span className="ml-3 text-sm font-medium text-sidebar-foreground">
          Inspection Tracker
        </span>
      </div>

      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full w-[220px] flex-col border-r border-sidebar-border bg-sidebar transition-transform md:static md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* App title */}
        <div className="flex h-12 items-center px-3">
          <span className="text-sm font-medium text-sidebar-foreground">
            Inspection Tracker
          </span>
        </div>

        <Separator />

        {/* Location selector */}
        <div className="p-3">
          <LocationSelector locations={locations} />
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            const Icon = link.icon

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-none px-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-muted"
                )}
              >
                <Icon weight={isActive ? "bold" : "regular"} className="size-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <Separator />

        {/* User section */}
        <div className="space-y-2 p-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-sidebar-foreground">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <Badge
              variant={(roleVariant[user.role] ?? "outline") as any}
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 pt-16 md:p-6 md:pt-6">
        {children}
      </main>
    </div>
  )
}
