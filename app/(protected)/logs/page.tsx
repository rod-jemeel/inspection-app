import type { Metadata } from "next"
import Link from "next/link"
import { FileSpreadsheet, Pill, ClipboardList, Syringe, CalendarCheck, HeartPulse, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Logs - Inspection Tracker",
}

const logTypes = [
  {
    id: "narcotic_log",
    title: "Narcotic Log",
    description: "Daily controlled substance tracking with patient rows, drug counts, and dual licensed staff signatures.",
    href: "/logs/narcotic",
    icon: FileSpreadsheet,
  },
  {
    id: "controlled_substance_inventory",
    title: "Controlled Substances Inventory",
    description: "Perpetual inventory ledger per drug — tracks orders, usage, waste, and running stock with dual signatures.",
    href: "/logs/inventory",
    icon: Pill,
  },
  {
    id: "crash_cart_checklist",
    title: "Crash Cart Monthly Checklist",
    description: "Monthly inventory of crash cart items by drawer — Par levels, expirations, and counts for each month.",
    href: "/logs/crash-cart",
    icon: ClipboardList,
  },
  {
    id: "narcotic_signout",
    title: "Narcotic Sign-out Form",
    description: "Anesthesiologist/CRNA narcotic sign-out with 4 drug columns, patient cases, and waste tracking.",
    href: "/logs/narcotic-signout",
    icon: Syringe,
  },
  {
    id: "daily_narcotic_count",
    title: "Daily Narcotic Count",
    description: "Monthly overview of daily narcotic counts — AM/Received/Used/PM tracking for Fentanyl, Midazolam, and Ephedrine.",
    href: "/logs/narcotic-count",
    icon: CalendarCheck,
  },
  {
    id: "cardiac_arrest_record",
    title: "Cardiac Arrest Record",
    description: "Event-based cardiac arrest documentation — vitals, drugs, defibrillation, IV solutions, and outcome tracking.",
    href: "/logs/cardiac-arrest",
    icon: HeartPulse,
  },
  {
    id: "crash_cart_daily",
    title: "Crash Cart Daily Checklist",
    description: "Daily AED and crash cart inspection — equipment checks, lock verification, and compliance tracking.",
    href: "/logs/crash-cart-daily",
    icon: ShieldCheck,
  },
]

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view logs</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-hidden">
      <div>
        <h2 className="text-sm font-semibold">Permanent Forms & Logs</h2>
        <p className="text-xs text-muted-foreground">
          Daily record-keeping logs for compliance tracking
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {logTypes.map((log) => (
          <Link key={log.id} href={`${log.href}?loc=${loc}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <log.icon className="size-4 text-muted-foreground" />
                  <CardTitle className="text-sm">{log.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  {log.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
