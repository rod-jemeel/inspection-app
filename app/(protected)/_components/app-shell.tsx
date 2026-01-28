"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQueryState } from "nuqs"

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

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/templates": "Templates",
  "/inspections": "Inspections",
  "/invites": "Invites",
  "/settings": "Settings",
  "/change-password": "Change Password",
}

export function AppShell({ user, locations, children, mustChangePassword }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [locationId, setLocationId] = useQueryState("loc")

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

  const pageTitle = pageTitles[pathname] ?? "Inspection Tracker"

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        locations={locations}
        currentLocationId={locationId}
        onLocationChange={handleLocationChange}
        onSignOut={handleSignOut}
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
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
