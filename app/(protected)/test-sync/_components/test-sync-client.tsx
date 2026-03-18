"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, FlaskConical, ExternalLink, SheetIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Binder {
  id: string
  name: string
  color: string | null
  icon: string | null
}

interface FormTemplate {
  id: string
  binder_id: string
  name: string
  frequency: string | null
  google_sheet_id: string | null
  google_sheet_tab: string | null
}

interface TestResult {
  success: boolean
  statusCode?: number
  error?: string
  webhookUrl?: string
}

interface TestSyncClientProps {
  locationId: string
  binders: Binder[]
  templates: FormTemplate[]
}

const frequencyColors: Record<string, string> = {
  daily: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  weekly: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  monthly: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  quarterly: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  annual: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  yearly: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  every_3_years: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400",
  as_needed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

const frequencyLabels: Record<string, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly",
  annual: "Annual", yearly: "Yearly", every_3_years: "Every 3 Years", as_needed: "As Needed",
}

export function TestSyncClient({ locationId, binders, templates }: TestSyncClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, TestResult>>({})

  const templatesByBinder = binders.map((binder) => ({
    binder,
    templates: templates.filter((t) => t.binder_id === binder.id),
  })).filter((b) => b.templates.length > 0)

  const uncategorized = templates.filter(
    (t) => !binders.find((b) => b.id === t.binder_id)
  )

  const handleTest = async (template: FormTemplate) => {
    setLoading(template.id)
    try {
      const res = await fetch("/api/test/webhook-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, formTemplateId: template.id }),
      })
      const data = await res.json()
      setResults((prev) => ({ ...prev, [template.id]: data }))
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [template.id]: { success: false, error: "Network error" },
      }))
    } finally {
      setLoading(null)
    }
  }

  const totalForms = templates.length
  const configuredForms = templates.filter((t) => t.google_sheet_id).length
  const testedForms = Object.keys(results).length
  const passedForms = Object.values(results).filter((r) => r.success).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Test Form Sync</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a test webhook payload to n8n for each form to verify Google Sheets sync is working.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/binders?loc=${locationId}`)}>
          Back to Binders
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Forms", value: totalForms },
          { label: "Sheet Configured", value: configuredForms, highlight: configuredForms < totalForms },
          { label: "Tested", value: testedForms },
          { label: "Passed", value: passedForms, success: true },
        ].map(({ label, value, highlight, success }) => (
          <div key={label} className="rounded-md border bg-card p-3 text-center">
            <p className={cn(
              "text-2xl font-bold",
              highlight && value < totalForms ? "text-amber-600" : "",
              success && value > 0 ? "text-emerald-600" : "",
            )}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Form list by binder */}
      <div className="space-y-6">
        {templatesByBinder.map(({ binder, templates: binderTemplates }) => (
          <div key={binder.id} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{binder.name}</h2>
            <div className="space-y-2">
              {binderTemplates.map((template) => (
                <FormRow
                  key={template.id}
                  template={template}
                  result={results[template.id]}
                  isLoading={loading === template.id}
                  onTest={() => handleTest(template)}
                  onOpen={() =>
                    router.push(
                      `/binders/${template.binder_id}/forms/${template.id}?loc=${locationId}`
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}

        {uncategorized.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Uncategorized</h2>
            <div className="space-y-2">
              {uncategorized.map((template) => (
                <FormRow
                  key={template.id}
                  template={template}
                  result={results[template.id]}
                  isLoading={loading === template.id}
                  onTest={() => handleTest(template)}
                  onOpen={() =>
                    router.push(
                      `/binders/${template.binder_id}/forms/${template.id}?loc=${locationId}`
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {templates.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-16">
            <FlaskConical className="mb-3 size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-muted-foreground">No forms found</p>
            <p className="text-xs text-muted-foreground">Create forms in your binders first</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FormRow({
  template,
  result,
  isLoading,
  onTest,
  onOpen,
}: {
  template: FormTemplate
  result?: TestResult
  isLoading: boolean
  onTest: () => void
  onOpen: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card p-3 shadow-sm">
      {/* Status icon */}
      <div className="shrink-0">
        {result ? (
          result.success ? (
            <CheckCircle2 className="size-5 text-emerald-500" />
          ) : (
            <XCircle className="size-5 text-red-500" />
          )
        ) : (
          <div className="size-5 rounded-full border-2 border-muted" />
        )}
      </div>

      {/* Form info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium truncate">{template.name}</p>
          {template.frequency && (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium", frequencyColors[template.frequency] ?? "bg-gray-100 text-gray-700")}
            >
              {frequencyLabels[template.frequency] ?? template.frequency}
            </Badge>
          )}
          {template.google_sheet_id ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <SheetIcon className="size-2.5" />
              Sheet linked
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              No sheet
            </Badge>
          )}
        </div>

        {/* Result message */}
        {result && (
          <p className={cn("mt-0.5 text-xs", result.success ? "text-emerald-600" : "text-red-600")}>
            {result.success
              ? `✓ Synced — HTTP ${result.statusCode}`
              : `✗ ${result.error ?? `HTTP ${result.statusCode}`}`}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          title="Open form"
          onClick={onOpen}
        >
          <ExternalLink className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant={template.google_sheet_id ? "default" : "outline"}
          disabled={isLoading || !template.google_sheet_id}
          onClick={onTest}
          className="h-7 text-xs"
          title={!template.google_sheet_id ? "Configure a Google Sheet ID on this form first" : "Send test payload to n8n"}
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FlaskConical className="size-3.5" />
          )}
          <span className="ml-1">{isLoading ? "Sending…" : "Test"}</span>
        </Button>
      </div>
    </div>
  )
}
