"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryState } from "nuqs"
import {
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { FullscreenSignaturePad } from "@/components/fullscreen-signature-pad"

interface Instance {
  id: string
  template_id: string
  template_task?: string
  template_frequency?: "weekly" | "monthly" | "yearly" | "every_3_years" | null
  location_id: string
  due_at: string
  assigned_to_profile_id: string | null
  assigned_to_email: string | null
  status: "pending" | "in_progress" | "failed" | "passed" | "void"
  remarks: string | null
  inspected_at: string | null
  failed_at: string | null
  passed_at: string | null
}

interface Template {
  id: string
  task: string
  description: string | null
  frequency: "weekly" | "monthly" | "yearly" | "every_3_years"
}

interface InspectionEvent {
  id: string
  event_type: string
  event_at: string
  payload: Record<string, unknown> | null
}

interface Signature {
  id: string
  signed_at: string
  signed_by_profile_id: string
  signature_image_path: string
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

interface InspectionModalProps {
  locationId: string
  profileId: string
}

export function InspectionModal({ locationId, profileId }: InspectionModalProps) {
  const router = useRouter()
  const [instanceId, setInstanceId] = useQueryState("instance")

  const [instance, setInstance] = useState<Instance | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [events, setEvents] = useState<InspectionEvent[]>([])
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [remarks, setRemarks] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignature, setShowSignature] = useState(false)

  const isOpen = !!instanceId
  const isTerminal = instance?.status === "passed" || instance?.status === "void"
  const isAssignedInspector = instance?.assigned_to_profile_id === profileId

  // Fetch instance data when modal opens
  useEffect(() => {
    if (!instanceId) {
      setInstance(null)
      setTemplate(null)
      setEvents([])
      setSignatures([])
      setRemarks("")
      setError(null)
      return
    }

    async function fetchData() {
      setFetching(true)
      setError(null)

      try {
        // Fetch instance
        const instanceRes = await fetch(`/api/locations/${locationId}/instances/${instanceId}`)
        if (!instanceRes.ok) throw new Error("Failed to fetch inspection")
        const instanceJson = await instanceRes.json()
        const instanceData = instanceJson.data ?? instanceJson
        setInstance(instanceData)

        // Initialize remarks from instance
        setRemarks(instanceData.remarks ?? "")

        // Fetch template, events, signatures in parallel
        const [templateRes, eventsRes, signaturesRes] = await Promise.all([
          fetch(`/api/locations/${locationId}/templates/${instanceData.template_id}`).catch(() => null),
          fetch(`/api/locations/${locationId}/instances/${instanceId}/events`),
          fetch(`/api/locations/${locationId}/instances/${instanceId}/sign`),
        ])

        if (templateRes?.ok) {
          const templateJson = await templateRes.json()
          setTemplate(templateJson.data ?? templateJson)
        }

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          setEvents(eventsData.data ?? [])
        }

        if (signaturesRes.ok) {
          const sigsData = await signaturesRes.json()
          setSignatures(sigsData.data ?? [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setFetching(false)
      }
    }

    fetchData()
  }, [instanceId, locationId])

  // Handle remarks change (local state only - no URL sync)
  const handleRemarksChange = useCallback((value: string) => {
    setRemarks(value)
  }, [])

  const handleClose = useCallback(() => {
    setInstanceId(null)
    setShowSignature(false)
  }, [setInstanceId])

  const handleStatusChange = async (newStatus: string) => {
    if (!instance) return
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
        throw new Error(err.error?.message || "Failed to update status")
      }

      const updatedJson = await response.json()
      const updated = updatedJson.data ?? updatedJson
      setInstance(updated)

      // Show signature pad if marking as passed and user is assigned
      if (newStatus === "passed" && updated.assigned_to_profile_id === profileId) {
        setShowSignature(true)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleSignatureSave = async (data: { imageBlob: Blob; points: unknown }) => {
    if (!instance) return
    setLoading(true)
    setError(null)

    try {
      // If inspection is in_progress, first update status to passed
      if (instance.status === "in_progress") {
        const statusResponse = await fetch(`/api/locations/${locationId}/instances/${instance.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "passed",
            ...(remarks ? { remarks } : {}),
          }),
        })

        if (!statusResponse.ok) {
          const err = await statusResponse.json()
          throw new Error(err.error?.message || "Failed to update status")
        }
      }

      // Then save signature
      const formData = new FormData()
      formData.append("signature", data.imageBlob, "signature.png")
      formData.append("points", JSON.stringify(data.points))
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
        throw new Error(err.error?.message || "Failed to save signature")
      }

      setShowSignature(false)
      handleClose()
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

  // Show fullscreen signature pad
  if (showSignature) {
    return (
      <FullscreenSignaturePad
        onSave={handleSignatureSave}
        onCancel={() => setShowSignature(false)}
        disabled={loading}
      />
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {fetching ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="sr-only">Loading inspection...</DialogTitle>
              <div className="flex items-start justify-between gap-4 pr-6">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Separator />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        ) : instance ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4 pr-6">
                <div className="space-y-1">
                  <DialogTitle className="text-base">
                    {template?.task ?? instance.template_task ?? "Inspection Task"}
                  </DialogTitle>
                  {template?.description && (
                    <DialogDescription>{template.description}</DialogDescription>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(template?.frequency || instance.template_frequency) && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        FREQ_CONFIG[template?.frequency ?? instance.template_frequency ?? ""]?.className
                      )}
                    >
                      {FREQ_CONFIG[template?.frequency ?? instance.template_frequency ?? ""]?.label ?? "Unknown"}
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
            </DialogHeader>

            {/* Error Display */}
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Details */}
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
                    onChange={(e) => handleRemarksChange(e.target.value)}
                    placeholder="Add any notes or comments while inspecting..."
                    disabled={isTerminal || loading}
                    className="min-h-20 text-xs"
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
                      {isAssignedInspector ? (
                        <Button
                          onClick={() => setShowSignature(true)}
                          disabled={loading}
                          size="sm"
                        >
                          <CheckCircle className="size-3.5" />
                          Complete & Sign
                        </Button>
                      ) : (
                        <Button disabled size="sm" variant="outline">
                          <CheckCircle className="size-3.5" />
                          Only assigned inspector can complete
                        </Button>
                      )}
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

            {/* Signature Section - only show if already signed */}
            {signatures.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="text-xs font-medium">Signature</div>
                  <div className="space-y-3">
                    {signatures.map((sig) => (
                      <div
                        key={sig.id}
                        className="rounded-md border p-4"
                      >
                        <div className="mb-3 flex items-center gap-2 text-xs">
                          <PenTool className="size-4 text-primary" />
                          <span className="font-medium">Signed</span>
                          <span className="text-muted-foreground">· {formatDate(sig.signed_at)}</span>
                        </div>
                        <div className="flex justify-center rounded border bg-white p-2">
                          <img
                            src={`/api/locations/${locationId}/instances/${instance.id}/sign/${sig.id}/image`}
                            alt="Signature"
                            className="h-24 max-w-full object-contain"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Event Timeline - hide signed events if signatures are shown above */}
            {events.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="text-xs font-medium">Activity Timeline</div>
                  <div className="space-y-3">
                    {events
                      .filter(e => !(e.event_type === "signed" && signatures.length > 0))
                      .slice(0, 5)
                      .map((event) => {
                        const config =
                          EVENT_ICONS[event.event_type as keyof typeof EVENT_ICONS] ??
                          EVENT_ICONS.comment
                        const Icon = config.Icon

                        return (
                          <div key={event.id} className="flex gap-2">
                            <div
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-md border bg-background",
                                config.color
                              )}
                            >
                              <Icon className="size-3" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <div className="text-xs font-medium capitalize">
                                  {event.event_type.replace("_", " ")}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {formatEventTime(event.event_at)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    {events.filter(e => !(e.event_type === "signed" && signatures.length > 0)).length > 5 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{events.filter(e => !(e.event_type === "signed" && signatures.length > 0)).length - 5} more events
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <DialogHeader>
            <DialogTitle>Not Found</DialogTitle>
            <DialogDescription className="py-8 text-center">
              Inspection not found
            </DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  )
}
