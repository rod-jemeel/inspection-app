import type { LucideIcon } from "lucide-react"
import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  iconClassName?: string
  iconContainerClassName?: string
  iconStyle?: CSSProperties
  actions?: React.ReactNode
  toolbar?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconClassName,
  iconContainerClassName,
  iconStyle,
  actions,
  toolbar,
  className,
}: PageHeaderProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-border/60",
                iconContainerClassName
              )}
              style={iconStyle}
            >
              <Icon className={cn("size-5", iconClassName)} />
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 self-start">
            {actions}
          </div>
        ) : null}
      </div>
      {toolbar ? (
        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
          {toolbar}
        </div>
      ) : null}
    </section>
  )
}
