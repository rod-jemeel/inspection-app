"use client"

import { useEffect, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { signOut } from "@/lib/auth-client"
import type { Role } from "@/lib/permissions"

interface AppShellProps {
  user: {
    name: string
    email: string | null
    role: Role
  }
  locations: { id: string; name: string }[]
  binders?: { id: string; name: string; color: string | null }[]
  children: React.ReactNode
  mustChangePassword?: boolean
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/binders": "Binders",
  "/templates": "Templates",
  "/inspections": "Inspections",
  "/logs": "Logs",
  "/logs/narcotic": "Narcotic Log",
  "/logs/inventory": "Controlled Substances Inventory",
  "/logs/crash-cart": "Crash Cart Monthly Checklist",
  "/logs/crash-cart-daily": "Crash Cart Daily Checklist",
  "/logs/narcotic-signout": "Narcotic Sign-out",
  "/logs/narcotic-count": "Daily Narcotic Count",
  "/logs/cardiac-arrest": "Cardiac Arrest Record",
  "/invites": "Invites",
  "/settings": "Settings",
  "/change-password": "Change Password",
  "/help": "Help & User Guide",
}

export function AppShell({ user, locations, binders, children, mustChangePassword }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [locationId, setLocationId] = useQueryState("loc", parseAsString.withDefault(""))

  // Set default location if none selected
  useEffect(() => {
    if (!locationId && locations.length > 0) {
      setLocationId(locations[0].id)
    }
  }, [locationId, locations, setLocationId])

  // Redirect to change-password if required
  useEffect(() => {
    if (mustChangePassword && pathname !== "/change-password") {
      router.push("/change-password")
    }
  }, [mustChangePassword, pathname, router])

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const handleLocationChange = (id: string) => {
    setLocationId(id)
  }

  const [drugParam] = useQueryState("drug", parseAsString)

  // Build hierarchical breadcrumb segments from pathname
  const breadcrumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean)
    const segments: { label: string; href: string }[] = []
    let currentPath = ""
    for (const part of parts) {
      currentPath += `/${part}`
      const title = pageTitles[currentPath]
      if (title) {
        segments.push({ label: title, href: currentPath })
      }
    }
    // Fallback: if no segments matched, use pathname as-is
    if (segments.length === 0) {
      segments.push({ label: "Inspection Tracker", href: pathname })
    }
    return segments
  }, [pathname])

  // Extra context from search params (e.g., drug name on inventory page)
  const drugLabel = useMemo(() => {
    if (!drugParam || !pathname.startsWith("/logs/inventory")) return null
    // Check preset drugs
    const presets: Record<string, string> = {
      versed: "Versed (Midazolam)",
      fentanyl: "Fentanyl Citrate",
      ephedrine: "Ephedrine Sulfate",
    }
    return presets[drugParam] ?? drugParam.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }, [drugParam, pathname])

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        locations={locations}
        currentLocationId={locationId}
        onLocationChange={handleLocationChange}
        onSignOut={handleSignOut}
        binders={binders}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={locationId ? `/dashboard?loc=${locationId}` : "/dashboard"}>
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((segment, i) => {
                  const isLast = i === breadcrumbs.length - 1 && !drugLabel
                  const locQuery = locationId ? `?loc=${locationId}` : ""
                  return (
                    <span key={segment.href} className="contents">
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem className={!isLast ? "hidden md:block" : ""}>
                        {isLast ? (
                          <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={`${segment.href}${locQuery}`}>
                            {segment.label}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </span>
                  )
                })}
                {drugLabel && (
                  <span className="contents">
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{drugLabel}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </span>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
