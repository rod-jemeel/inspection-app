import type { Metadata } from "next"
import Link from "next/link"
import { FileSpreadsheet } from "lucide-react"
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
    <div className="space-y-4">
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
