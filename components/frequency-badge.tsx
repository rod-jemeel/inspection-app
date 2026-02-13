import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const FREQ_CONFIG: Record<string, { label: string; className: string }> = {
  daily: { label: "Daily", className: "bg-red-100 text-red-700 border-red-200" },
  weekly: { label: "Weekly", className: "bg-blue-100 text-blue-700 border-blue-200" },
  monthly: { label: "Monthly", className: "bg-green-100 text-green-700 border-green-200" },
  quarterly: { label: "Quarterly", className: "bg-teal-100 text-teal-700 border-teal-200" },
  yearly: { label: "Yearly", className: "bg-amber-100 text-amber-700 border-amber-200" },
  every_3_years: { label: "Every 3 Years", className: "bg-purple-100 text-purple-700 border-purple-200" },
}

export function FrequencyBadge({ frequency, className }: { frequency: string; className?: string }) {
  const config = FREQ_CONFIG[frequency]
  if (!config) return null
  return (
    <Badge variant="outline" className={cn("text-[10px]", config.className, className)}>
      {config.label}
    </Badge>
  )
}
