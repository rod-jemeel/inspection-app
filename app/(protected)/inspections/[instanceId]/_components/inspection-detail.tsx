"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Play,
  XCircle,
  CheckCircle,
  Ban,
  RefreshCw,
  PenTool,
  Plus,
  AlertTriangle,
  Bell,
  MessageSquare,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { SignaturePad } from "@/components/signature-pad"
import type { Instance } from "@/lib/server/services/instances"
import type { Template } from "@/lib/server/services/templates"
import type { InspectionEvent } from "@/lib/server/services/events"
import type { Signature } from "@/lib/server/services/signatures"

interface InspectionDetailProps {
  instance: Instance
  template: Template | null
  events: InspectionEvent[]
  signatures: Signature[]
  locationId: string
  profileId: string
}

const STATUS_VARIANT: Record<string, string> = {
  pending: "outline",
  in_progress: "secondary",
  failed: "destructive",
  passed: "default",
  void: "ghost",
}

const FREQ_CONFIG: Record<string, { label: string; className: string }> = {
  weekly: { label: "Weekly", className: "bg-blue-100 text-blue-700 border-blue-200" },
  monthly: { label: "Monthly", className: "bg-green-100 text-green-700 border-green-200" },
  yearly: { label: "Yearly", className: "bg-amber-100 text-amber-700 border-amber-200" },
  every_3_years: { label: "Every 3 Years", className: "bg-purple-100 text-purple-700 border-purple-200" },
}

const EVENT_ICONS = {
  created: { Icon: Plus, color: "text-primary" },
  assigned: { Icon: UserPlus, color: "text-primary" },
  started: { Icon: Play, color: "text-primary" },
  failed: { Icon: XCircle, color: "text-destructive" },
  passed: { Icon: CheckCircle, color: "text-primary" },
  signed: { Icon: PenTool, color: "text-primary" },
  comment: { Icon: MessageSquare, color: "text-muted-foreground" },
  reminder_sent: { Icon: Bell, color: "text-muted-foreground" },
  escalated: { Icon: AlertTriangle, color: "text-destructive" },
}

export function InspectionDetail({
  instance: initialInstance,
  template,
  events,
  signatures,
  locationId,
  profileId,
}: InspectionDetailProps) {
  const router = useRouter()
  const [instance, setInstance] = useState(initialInstance)
  const [remarks, setRemarks] = useState(instance.remarks ?? "")
  const [showSignature, setShowSignature] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTerminal = instance.status === "passed" || instance.status === "void"
  const isAssignedInspector = instance.assigned_to_profile_id === profileId
  const canSign = instance.status === "passed" && signatures.length === 0 && isAssignedInspector

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/locations/${locationId}/instances/${instance.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(remarks ? { remarks } : {}),
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || "Failed to update status")
      }

      const updated = await response.json()
      setInstance(updated)

      // Show signature pad if marking as passed
      if (newStatus === "passed") {
        setShowSignature(true)
      } else {
        // Refresh the page to show new events
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleSignatureSave = async (data: { imageBlob: Blob; points: unknown; signerName: string }) => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("signature", data.imageBlob, "signature.png")
      formData.append("points", JSON.stringify(data.points))
      formData.append("signerName", data.signerName)
      formData.append(
        "deviceMeta",
        JSON.stringify({
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
        })
      )

      const response = await fetch(`/api/locations/${locationId}/instances/${instance.id}/sign`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || "Failed to save signature")
      }

      setShowSignature(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-4 py-6">
      {/* Back Link */}
      <Link
        href={`/inspections?loc=${locationId}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Inspections
      </Link>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-xs text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>
                {template?.task ?? "Inspection Task"}
              </CardTitle>
              {template?.description && (
                <CardDescription>{template.description}</CardDescription>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {template?.frequency && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    FREQ_CONFIG[template.frequency]?.className
                  )}
                >
                  {FREQ_CONFIG[template.frequency]?.label ?? "Unknown"}
                </Badge>
              )}
              <Badge
                variant={(STATUS_VARIANT[instance.status] ?? "outline") as any}
                className="capitalize"
              >
                {instance.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Due Date</div>
              <div className="font-medium">{formatDate(instance.due_at)}</div>
            </div>
            {instance.assigned_to_email && (
              <div>
                <div className="text-muted-foreground">Assigned To</div>
                <div className="font-medium">{instance.assigned_to_email}</div>
              </div>
            )}
            {instance.inspected_at && (
              <div>
                <div className="text-muted-foreground">Inspected At</div>
                <div className="font-medium">{formatDate(instance.inspected_at)}</div>
              </div>
            )}
            {instance.passed_at && (
              <div>
                <div className="text-muted-foreground">Passed At</div>
                <div className="font-medium">{formatDate(instance.passed_at)}</div>
              </div>
            )}
            {instance.failed_at && (
              <div>
                <div className="text-muted-foreground">Failed At</div>
                <div className="font-medium">{formatDate(instance.failed_at)}</div>
              </div>
            )}
          </div>

          {/* Remarks Section - only show during/after inspection (not pending) */}
          {(instance.status !== "pending" || instance.remarks) && (
            <>
              <Separator />
              <div className="space-y-2">
                <label htmlFor="remarks" className="text-xs font-medium">
                  Remarks
                </label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any notes or comments while inspecting..."
                  disabled={isTerminal || loading}
                  className="min-h-20"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          {!isTerminal && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {instance.status === "pending" && (
                  <>
                    <Button
                      onClick={() => handleStatusChange("in_progress")}
                      disabled={loading}
                      size="sm"
                    >
                      <Play className="size-3.5" />
                      Start Inspection
                    </Button>
                    <Button
                      onClick={() => handleStatusChange("void")}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                    >
                      <Ban className="size-3.5" />
                      Void
                    </Button>
                  </>
                )}

                {instance.status === "in_progress" && (
                  <>
                    <Button
                      onClick={() => handleStatusChange("passed")}
                      disabled={loading}
                      size="sm"
                    >
                      <CheckCircle className="size-3.5" />
                      Mark Passed
                    </Button>
                    <Button
                      onClick={() => handleStatusChange("failed")}
                      disabled={loading}
                      variant="destructive"
                      size="sm"
                    >
                      <XCircle className="size-3.5" />
                      Mark Failed
                    </Button>
                    <Button
                      onClick={() => handleStatusChange("void")}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                    >
                      <Ban className="size-3.5" />
                      Void
                    </Button>
                  </>
                )}

                {instance.status === "failed" && (
                  <Button
                    onClick={() => handleStatusChange("in_progress")}
                    disabled={loading}
                    size="sm"
                  >
                    <RefreshCw className="size-3.5" />
                    Re-inspect
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Signature Section */}
      {(canSign || showSignature || signatures.length > 0 || (instance.status === "passed" && !isAssignedInspector)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {signatures.length > 0 ? (
              <div className="space-y-2">
                {signatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="flex items-center justify-between rounded-none border border-border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <PenTool className="size-4 text-primary" />
                      <div className="text-xs">
                        <div className="font-medium">Signed</div>
                        <div className="text-muted-foreground">{formatDate(sig.signed_at)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : showSignature ? (
              <SignaturePad
                onSave={handleSignatureSave}
                onCancel={() => setShowSignature(false)}
                disabled={loading}
              />
            ) : canSign ? (
              <Button
                onClick={() => setShowSignature(true)}
                disabled={loading}
                size="sm"
              >
                <PenTool className="size-3.5" />
                Add Signature
              </Button>
            ) : instance.status === "passed" && !isAssignedInspector && signatures.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Only the assigned inspector ({instance.assigned_to_email ?? "unassigned"}) can sign this inspection.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Event Timeline */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map((event, index) => {
                const config =
                  EVENT_ICONS[event.event_type as keyof typeof EVENT_ICONS] ??
                  EVENT_ICONS.comment
                const Icon = config.Icon

                return (
                  <div key={event.id} className="flex gap-3">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-none border border-border bg-background",
                        config.color
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 space-y-1 pt-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-xs font-medium capitalize">
                          {event.event_type.replace("_", " ")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatEventTime(event.event_at)}
                        </div>
                      </div>
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {JSON.stringify(event.payload, null, 2)}
                        </div>
                      )}
                      {index < events.length - 1 && (
                        <div className="h-4 border-l border-border pl-4" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
