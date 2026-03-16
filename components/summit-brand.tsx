import Image from "next/image"

import { cn } from "@/lib/utils"

type SummitBrandSize = "sm" | "md" | "lg"

interface SummitBrandProps {
  className?: string
  contentClassName?: string
  logoClassName?: string
  size?: SummitBrandSize
  subtitle?: string
  title?: string
  priority?: boolean
}

const sizeClasses: Record<SummitBrandSize, { shell: string; image: string; title: string; subtitle: string }> = {
  sm: {
    shell: "size-10 rounded-2xl p-1.5",
    image: "size-6",
    title: "text-sm",
    subtitle: "text-[0.68rem]",
  },
  md: {
    shell: "size-12 rounded-[1.4rem] p-1.5",
    image: "size-7",
    title: "text-base",
    subtitle: "text-[0.72rem]",
  },
  lg: {
    shell: "size-[3.35rem] rounded-[1.45rem] p-1.5",
    image: "size-8",
    title: "text-xl",
    subtitle: "text-[0.78rem]",
  },
}

export function SummitBrand({
  className,
  contentClassName,
  logoClassName,
  size = "md",
  subtitle = "Inspection Tracker",
  title = "Summit",
  priority = false,
}: SummitBrandProps) {
  const classes = sizeClasses[size]

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden border border-white/70 bg-white/80 shadow-[0_22px_55px_-28px_rgba(20,41,61,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5",
          classes.shell,
          logoClassName
        )}
      >
        <Image
          src="/summit-logo.svg"
          alt="Summit logo"
          width={96}
          height={96}
          priority={priority}
          className={cn("object-contain", classes.image)}
        />
      </div>
      <div className={cn("min-w-0", contentClassName)}>
        <p className={cn("truncate font-semibold uppercase tracking-[0.22em] text-foreground", classes.title)}>
          {title}
        </p>
        <p className={cn("truncate text-muted-foreground", classes.subtitle)}>{subtitle}</p>
      </div>
    </div>
  )
}
