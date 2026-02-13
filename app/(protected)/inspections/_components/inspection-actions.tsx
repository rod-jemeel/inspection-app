"use client"

import { Play, XCircle, CheckCircle, Ban, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Instance {
  id: string
  template_id: string
  template_task?: string
  template_frequency?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years" | null
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

interface InspectionActionsProps {
  instance: Instance
  loading: boolean
  hasLinkedForm: boolean
  isAssignedInspector: boolean
  onStatusChange: (status: string) => void
  onNavigateToForm: () => void
  onCompleteAndSign: () => void
}

export function InspectionActions({
  instance,
  loading,
  hasLinkedForm,
  isAssignedInspector,
  onStatusChange,
  onNavigateToForm,
  onCompleteAndSign,
}: InspectionActionsProps) {
  const isTerminal = instance.status === "passed" || instance.status === "void"

  if (isTerminal) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {instance.status === "pending" && (
        <>
          <Button
            onClick={() => onStatusChange("in_progress")}
            disabled={loading || !instance.assigned_to_profile_id}
            title={!instance.assigned_to_profile_id ? "Assign an inspector first" : undefined}
            size="sm"
          >
            <Play className="size-3.5" />
            Start Inspection
          </Button>
          <Button
            onClick={() => onStatusChange("void")}
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
          {hasLinkedForm ? (
            <Button
              onClick={onNavigateToForm}
              disabled={loading}
              size="sm"
            >
              <Play className="size-3.5" />
              Fill Form
            </Button>
          ) : isAssignedInspector ? (
            <Button
              onClick={onCompleteAndSign}
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
            onClick={() => onStatusChange("failed")}
            disabled={loading}
            variant="destructive"
            size="sm"
          >
            <XCircle className="size-3.5" />
            Mark Failed
          </Button>
          <Button
            onClick={() => onStatusChange("void")}
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
          onClick={() => onStatusChange("in_progress")}
          disabled={loading}
          size="sm"
        >
          <RefreshCw className="size-3.5" />
          Re-inspect
        </Button>
      )}
    </div>
  )
}
