"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface NavMainProps {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
  locationId: string | null
}

export function NavMain({ items, locationId }: NavMainProps) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const href = locationId ? `${item.url}?loc=${locationId}` : item.url
          const isActive = pathname === item.url

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                <Link href={href}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
