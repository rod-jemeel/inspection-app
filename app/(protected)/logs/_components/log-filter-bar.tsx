"use client"

import { cn } from "@/lib/utils"

interface LogFilterBarProps {
  children: React.ReactNode
  className?: string
}

export function LogFilterBar({ children, className }: LogFilterBarProps) {
  return (
    <div className={cn("rounded-md border border-border/50 bg-muted/10 p-3", className)}>
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </div>
  )
}
