import type { Metadata } from "next"
import Link from "next/link"
import {
  FileSpreadsheet,
  CalendarCheck,
  ClipboardList,
  FileText,
  BarChart3,
  BookOpen,
  Clock,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { listBinders } from "@/lib/server/services/binders"
import { listFormTemplates } from "@/lib/server/services/form-templates"
import { FrequencyBadge } from "@/components/frequency-badge"
import { supabase } from "@/lib/server/db"

export const metadata: Metadata = {
  title: "Logs",
}

// Forms that have custom UIs — keyed by exact form template name
const CUSTOM_LOG_SLUGS: Record<string, string> = {
  "Daily Narcotic Count": "narcotic-count",
  "Crash Cart Daily Checklist": "crash-cart-daily",
  "Controlled Substances Perpetual Inventory - Ephedrine": "inventory",
  "Controlled Substances Perpetual Inventory - Fentanyl": "inventory",
  "Controlled Substances Perpetual Inventory - Versed": "inventory",
  "CRNA Narcotic Sign-Out Form": "narcotic-signout",
  "Crash Cart Monthly Checklist": "crash-cart",
  "Cardiac Arrest Record": "cardiac-arrest",
}

const LOG_EXTRA_PARAMS: Record<string, Record<string, string>> = {
  "Controlled Substances Perpetual Inventory - Ephedrine": { drug: "ephedrine" },
  "Controlled Substances Perpetual Inventory - Fentanyl": { drug: "fentanyl" },
  "Controlled Substances Perpetual Inventory - Versed": { drug: "versed" },
}

const FREQUENCY_ICONS: Record<string, React.ElementType> = {
  daily: CalendarCheck,
  weekly: CalendarCheck,
  monthly: ClipboardList,
  quarterly: BarChart3,
  yearly: BookOpen,
  every_3_years: BookOpen,
  as_needed: Clock,
}

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

  await requireLocationAccess(loc)

  const binders = await listBinders(loc)
  const nursingBinder = binders.find((b: { name: string }) => b.name === "Nursing Logs")

  if (!nursingBinder) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Permanent Forms & Logs"
          description="Daily record-keeping logs for compliance tracking across the location."
          icon={FileSpreadsheet}
        />
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-sm">No &ldquo;Nursing Logs&rdquo; binder found for this location.</p>
        </div>
      </div>
    )
  }

  const forms = await listFormTemplates(loc, nursingBinder.id, { active: true })

  // Fetch the earliest pending/in_progress instance per form template
  const formIds = forms.map((f: { id: string }) => f.id)
  const { data: pendingInstances } = await supabase
    .from("inspection_instances")
    .select("id, form_template_id, status, due_at")
    .in("form_template_id", formIds)
    .in("status", ["pending", "in_progress"])
    .order("due_at", { ascending: true })

  // Map: formTemplateId → earliest pending instance
  const instanceByFormId = new Map<string, { id: string; status: string; due_at: string }>()
  for (const inst of pendingInstances ?? []) {
    if (!instanceByFormId.has(inst.form_template_id)) {
      instanceByFormId.set(inst.form_template_id, inst)
    }
  }

  return (
    <div className="space-y-4 overflow-hidden">
      <PageHeader
        title="Permanent Forms & Logs"
        description="Daily record-keeping logs for compliance tracking across the location."
        icon={FileSpreadsheet}
      />

      {forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-sm">No forms in the Nursing Logs binder.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => {
            const customSlug = CUSTOM_LOG_SLUGS[form.name]
            const instance = instanceByFormId.get(form.id)
            const instanceParam = instance ? `&instanceId=${instance.id}` : ""
            const extraParams = LOG_EXTRA_PARAMS[form.name] ?? {}
            const extraQuery = Object.entries(extraParams).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("")
            const href = customSlug
              ? `/logs/${customSlug}?loc=${loc}${instanceParam}${extraQuery}`
              : `/binders/${nursingBinder.id}/forms/${form.id}?loc=${loc}${instanceParam}`

            const Icon = FREQUENCY_ICONS[form.frequency ?? "as_needed"] ?? FileText
            const isDue = !!instance
            const isOverdue = instance
              ? new Date(instance.due_at) < new Date()
              : false

            return (
              <Link key={form.id} href={href} className="block h-full">
                <Card className={`flex h-full min-h-36 flex-col border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/35 hover:shadow-md ${isDue ? "ring-1 ring-primary/30" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/70">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-1 flex-wrap items-start gap-1.5 pt-1">
                        <CardTitle className="text-sm leading-5">{form.name}</CardTitle>
                        {isDue && (
                          <Badge
                            variant={isOverdue ? "destructive" : "default"}
                            className="h-4 shrink-0 px-1.5 text-[10px]"
                          >
                            {instance.status === "in_progress" ? "In Progress" : isOverdue ? "Overdue" : "Due"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-2 pt-0">
                    {form.description && (
                      <CardDescription className="text-xs leading-5">
                        {form.description}
                      </CardDescription>
                    )}
                    {form.frequency && (
                      <FrequencyBadge frequency={form.frequency as never} />
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
