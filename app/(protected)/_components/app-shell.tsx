"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

import { AppSidebar } from "@/components/app-sidebar";
import {
  PageBreadcrumbProvider,
  usePageBreadcrumbs,
  type PageBreadcrumbItem,
} from "@/components/page-breadcrumbs";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { signOut } from "@/lib/auth-client";
import type { Role } from "@/lib/permissions";

interface AppShellProps {
  user: {
    name: string;
    email: string | null;
    role: Role;
  };
  locations: { id: string; name: string }[];
  binders?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  }[];
  children: React.ReactNode;
  mustChangePassword?: boolean;
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
};

function AppShellChrome({
  binders,
  children,
  currentLocationId,
  defaultBreadcrumbs,
  handleLocationChange,
  handleSignOut,
  locations,
  user,
}: {
  binders?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  }[];
  children: React.ReactNode;
  currentLocationId: string;
  defaultBreadcrumbs: PageBreadcrumbItem[];
  handleLocationChange: (id: string) => void;
  handleSignOut: () => void;
  locations: { id: string; name: string }[];
  user: {
    name: string;
    email: string | null;
    role: Role;
  };
}) {
  const { items: overrideBreadcrumbs } = usePageBreadcrumbs();
  const breadcrumbs = overrideBreadcrumbs ?? defaultBreadcrumbs;

  return (
    <>
      <AppSidebar
        user={user}
        locations={locations}
        currentLocationId={currentLocationId}
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
                  <BreadcrumbLink
                    href={
                      currentLocationId
                        ? `/dashboard?loc=${currentLocationId}`
                        : "/dashboard"
                    }
                  >
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((segment, index) => {
                  const isLast = index === breadcrumbs.length - 1;

                  return (
                    <span
                      key={`${segment.label}-${segment.href ?? index}`}
                      className="contents"
                    >
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem
                        className={!isLast ? "hidden md:block" : ""}
                      >
                        {!isLast && segment.href ? (
                          <BreadcrumbLink href={segment.href}>
                            {segment.label}
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </span>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}

export function AppShell({
  user,
  locations,
  binders,
  children,
  mustChangePassword,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [locationId, setLocationId] = useQueryState(
    "loc",
    parseAsString.withDefault(""),
  );

  const firstLocationId = locations[0]?.id;

  // Set default location if none selected
  useEffect(() => {
    if (!locationId && firstLocationId) {
      setLocationId(firstLocationId);
    }
  }, [locationId, firstLocationId, setLocationId]);

  // Redirect to change-password if required
  useEffect(() => {
    if (mustChangePassword && pathname !== "/change-password") {
      router.push("/change-password");
    }
  }, [mustChangePassword, pathname, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleLocationChange = (id: string) => {
    setLocationId(id);
  };

  const [drugParam] = useQueryState("drug", parseAsString);

  const defaultBreadcrumbs = useMemo<PageBreadcrumbItem[]>(() => {
    const parts = pathname.split("/").filter(Boolean);
    const locQuery = locationId ? `?loc=${locationId}` : "";
    const segments: PageBreadcrumbItem[] = [];
    let currentPath = "";

    for (const part of parts) {
      currentPath += `/${part}`;
      const title = pageTitles[currentPath];
      if (title) {
        segments.push({ label: title, href: `${currentPath}${locQuery}` });
      }
    }

    if (segments.length === 0) {
      segments.push({ label: "Summit" });
    }

    if (drugParam && pathname.startsWith("/logs/inventory")) {
      const presets: Record<string, string> = {
        versed: "Versed (Midazolam)",
        fentanyl: "Fentanyl Citrate",
        ephedrine: "Ephedrine Sulfate",
      };

      segments.push({
        label:
          presets[drugParam] ??
          drugParam.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
      return segments;
    }

    const lastIndex = segments.length - 1;
    if (lastIndex >= 0) {
      segments[lastIndex] = {
        label: segments[lastIndex].label,
      };
    }

    return segments;
  }, [drugParam, locationId, pathname]);

  return (
    <PageBreadcrumbProvider>
      <SidebarProvider>
        <AppShellChrome
          user={user}
          locations={locations}
          binders={binders}
          currentLocationId={locationId}
          handleLocationChange={handleLocationChange}
          handleSignOut={handleSignOut}
          defaultBreadcrumbs={defaultBreadcrumbs}
        >
          {children}
        </AppShellChrome>
      </SidebarProvider>
    </PageBreadcrumbProvider>
  );
}
