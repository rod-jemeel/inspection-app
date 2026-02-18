"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LogsLayoutProps {
  children: React.ReactNode
}

export function LogsLayout({ children }: LogsLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const loc = searchParams.get("loc")
  const drug = searchParams.get("drug")

  // Only show back button on sub-pages (not the /logs listing itself)
  const isSubpage = pathname !== "/logs"

  // Determine back destination based on current context
  let backHref = `/logs${loc ? `?loc=${loc}` : ""}`
  let backLabel = "Back to Logs"

  // Inventory with drug selected → back to drug selector
  if (pathname === "/logs/inventory" && drug) {
    backHref = `/logs/inventory${loc ? `?loc=${loc}` : ""}`
    backLabel = "Back to Drug Selection"
  }

  return (
    <div className="space-y-4">
      {isSubpage && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => router.push(backHref)}
        >
          <ArrowLeft className="mr-1 size-3" />
          <span className="text-xs">{backLabel}</span>
        </Button>
      )}
      {children}
    </div>
  )
}
