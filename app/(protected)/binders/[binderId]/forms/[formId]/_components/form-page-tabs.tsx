"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, FlaskConical, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResponseList } from "../../../_components/response-list"

interface FormPageTabsProps {
  formContent: React.ReactNode
  binderId: string
  locationId: string
  formTemplateId: string
  googleSheetId?: string | null
  canEdit?: boolean
}

export function FormPageTabs({ formContent, binderId, locationId, formTemplateId, googleSheetId, canEdit }: FormPageTabsProps) {
  const router = useRouter()
  const [tab, setTab] = useState<"form" | "responses">("form")
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; statusCode?: number; error?: string } | null>(null)

  const handleTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/test/webhook-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, formTemplateId }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ success: false, error: "Network error" })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground"
          onClick={() => router.push(`/binders/${binderId}?loc=${locationId}`)}
        >
          <ChevronLeft className="size-3.5" />
          Binder
        </Button>
        <div className="h-4 w-px bg-border" />
        <Button
          variant={tab === "form" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setTab("form")}
        >
          Fill Form
        </Button>
        <Button
          variant={tab === "responses" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setTab("responses")}
        >
          Responses
        </Button>

        {canEdit && (
          <>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={testLoading || !googleSheetId}
              title={!googleSheetId ? "Configure a Google Sheet ID on this form first" : "Send a test payload to n8n"}
              onClick={handleTest}
            >
              {testLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : testResult ? (
                testResult.success ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="size-3.5 text-red-500" />
                )
              ) : (
                <FlaskConical className="size-3.5" />
              )}
              {testLoading
                ? "Sending…"
                : testResult
                  ? testResult.success
                    ? `Synced · ${testResult.statusCode}`
                    : `Failed · ${testResult.error ?? testResult.statusCode}`
                  : "Test Sync"}
            </Button>
          </>
        )}
      </div>

      {tab === "form" && formContent}
      {tab === "responses" && (
        <ResponseList
          binderId={binderId}
          locationId={locationId}
          formTemplateId={formTemplateId}
        />
      )}
    </div>
  )
}
