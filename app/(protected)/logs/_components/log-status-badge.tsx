"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type LogStatus = "draft" | "complete" | "ongoing"

interface LogStatusBadgeProps {
  status: LogStatus
  size?: "xs" | "sm"
  className?: string
}

export function LogStatusBadge({
  status,
  size = "xs",
  className,
}: LogStatusBadgeProps) {
  const variant =
    status === "complete"
      ? "default"
      : status === "draft"
        ? "secondary"
        : "outline"

  return (
    <Badge
      variant={variant}
      className={cn("capitalize", size === "xs" ? "text-[10px]" : "text-xs", className)}
    >
      {status}
    </Badge>
  )
}
