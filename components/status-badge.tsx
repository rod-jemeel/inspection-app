import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_CONFIG = {
  pending: { variant: "outline" as const, className: "" },
  in_progress: { variant: "secondary" as const, className: "" },
  failed: { variant: "destructive" as const, className: "" },
  passed: { variant: "default" as const, className: "bg-green-600 hover:bg-green-700" },
  void: { variant: "outline" as const, className: "opacity-50" },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? { variant: "outline" as const, className: "" }
  return (
    <Badge variant={config.variant} className={cn("text-[10px] capitalize", config.className, className)}>
      {status.replace("_", " ")}
    </Badge>
  )
}
