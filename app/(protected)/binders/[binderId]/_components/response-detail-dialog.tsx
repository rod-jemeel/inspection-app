"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle, XCircle, AlertTriangle, PenLine, Camera, Pencil } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface FieldResponse {
  id: string
  form_field_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: Record<string, unknown> | null
  attachment_url: string | null
  pass: boolean | null
  form_field?: {
    label: string
    field_type: string
    sort_order: number
  }
}

interface ResponseDetail {
  id: string
  form_template_id: string
  location_id: string
  inspection_instance_id: string | null
  submitted_by_profile_id: string
  submitted_at: string
  status: "draft" | "complete" | "flagged"
  overall_pass: boolean | null
  remarks: string | null
  corrective_action: string | null
  completion_signature: string | null
  completion_selfie: string | null
  submitted_by_name: string | null
  form_template_name: string | null
  field_responses: FieldResponse[]
}

interface ResponseDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  responseId: string | null
  locationId: string
  binderId: string
  onUpdated?: () => void
}

function formatFieldValue(fr: FieldResponse): string {
  if (fr.value_boolean !== null) return fr.value_boolean ? "Yes" : "No"
  if (fr.value_number !== null) return String(fr.value_number)
  if (fr.value_date !== null) return new Date(fr.value_date).toLocaleDateString()
  if (fr.value_datetime !== null) {
    return new Date(fr.value_datetime).toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    })
  }
  if (fr.value_json !== null) {
    const selected = (fr.value_json as { selected?: string[] }).selected
    return selected ? selected.join(", ") : JSON.stringify(fr.value_json)
  }
  if (fr.value_text !== null) return fr.value_text
  return "-"
}

const statusColors = {
  draft: "bg-gray-100 text-gray-700",
  complete: "bg-blue-100 text-blue-700",
  flagged: "bg-amber-100 text-amber-700",
}

export function ResponseDetailDialog({
  open,
  onOpenChange,
  responseId,
  locationId,
  binderId,
  onUpdated,
}: ResponseDetailDialogProps) {
  const router = useRouter()
  const [response, setResponse] = useState<ResponseDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editStatus, setEditStatus] = useState<string>("")
  const [editRemarks, setEditRemarks] = useState("")

  useEffect(() => {
    if (!open || !responseId) {
      setResponse(null)
      setEditMode(false)
      return
    }

    async function fetchResponse() {
      setLoading(true)
      try {
        const res = await fetch(`/api/locations/${locationId}/responses/${responseId}`)
        if (!res.ok) throw new Error("Failed to fetch response")
        const data = await res.json()
        setResponse(data)
        setEditStatus(data.status)
        setEditRemarks(data.remarks || "")
      } catch (error) {
        console.error("Error fetching response:", error)
        toast.error("Failed to load response")
        onOpenChange(false)
      } finally {
        setLoading(false)
      }
    }

    fetchResponse()
  }, [open, responseId, locationId, onOpenChange])

  const handleSave = async () => {
    if (!response) return
    setSaving(true)
    try {
      const res = await fetch(`/api/locations/${locationId}/responses/${response.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          remarks: editRemarks || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error?.message || "Failed to update response")
      }
      toast.success("Response updated")
      setEditMode(false)
      onUpdated?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  const sortedFields = response?.field_responses
    ?.slice()
    .sort((a, b) => (a.form_field?.sort_order ?? 0) - (b.form_field?.sort_order ?? 0))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {response?.form_template_name || "Form Response"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : response ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", statusColors[response.status])}
                >
                  {response.status}
                </Badge>
                {response.overall_pass !== null && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      response.overall_pass
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    )}
                  >
                    {response.overall_pass ? "Pass" : "Fail"}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  by {response.submitted_by_name || "Unknown"} on{" "}
                  {new Date(response.submitted_at).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
            </div>

            {/* Field Responses */}
            <div className="space-y-1 pt-2">
              {sortedFields?.map((fr) => (
                <div
                  key={fr.id}
                  className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {fr.form_field?.label || "Field"}
                    </p>
                    <p className="text-xs">
                      {formatFieldValue(fr)}
                    </p>
                  </div>
                  {fr.pass !== null && (
                    fr.pass ? (
                      <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-600" />
                    )
                  )}
                </div>
              ))}
            </div>

            {/* Signature / Selfie */}
            {(response.completion_signature || response.completion_selfie) && (
              <div className="flex gap-4 border-t pt-3">
                {response.completion_signature && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PenLine className="size-3.5" />
                    <span>Signed</span>
                  </div>
                )}
                {response.completion_selfie && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Camera className="size-3.5" />
                    <span>Selfie captured</span>
                  </div>
                )}
              </div>
            )}

            {/* Remarks */}
            {!editMode && response.remarks && (
              <div className="border-t pt-3">
                <p className="text-[11px] font-medium text-muted-foreground">Remarks</p>
                <p className="text-xs">{response.remarks}</p>
              </div>
            )}

            {/* Edit Mode */}
            {editMode && (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="flagged">Flagged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Remarks</p>
                  <Textarea
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    rows={2}
                    className="text-xs"
                    placeholder="Optional remarks..."
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              {editMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(false)}
                    disabled={saving}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="h-7 text-xs"
                  >
                    {saving && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(true)}
                    className="h-7 text-xs"
                  >
                    <AlertTriangle className="mr-1.5 size-3" />
                    Change Status
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false)
                      router.push(
                        `/binders/${binderId}/forms/${response.form_template_id}?loc=${locationId}&responseId=${response.id}`
                      )
                    }}
                    className="h-7 text-xs"
                  >
                    <Pencil className="mr-1.5 size-3" />
                    Edit Response
                  </Button>
                </>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
