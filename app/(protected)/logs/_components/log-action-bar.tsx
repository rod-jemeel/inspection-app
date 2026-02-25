"use client"

import { CheckCircle2, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

type DraftCompleteActionBarProps = {
  variant?: "draftComplete"
  status: "draft" | "complete"
  dirty: boolean
  saving: boolean
  isAdmin?: boolean
  entityLabel?: string
  onSaveDraft: () => void
  onSaveComplete: () => void
  onRevertToDraft?: () => void
}

type OngoingSaveOnlyActionBarProps = {
  variant: "ongoingSaveOnly"
  saving: boolean
  dirty: boolean
  saveLabel?: string
  onSave: () => void
}

export type LogActionBarProps =
  | DraftCompleteActionBarProps
  | OngoingSaveOnlyActionBarProps

export function LogActionBar(props: LogActionBarProps) {
  if (props.variant === "ongoingSaveOnly") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={props.onSave}
        disabled={props.saving || !props.dirty}
      >
        <Save className="mr-1 size-3" />
        {props.saving ? "Saving\u2026" : props.saveLabel ?? "Save"}
      </Button>
    )
  }

  const {
    status,
    dirty,
    saving,
    isAdmin = false,
    entityLabel = "log",
    onSaveDraft,
    onSaveComplete,
    onRevertToDraft,
  } = props

  if (status === "draft") {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={onSaveDraft}
          disabled={saving || !dirty}
        >
          <Save className="mr-1 size-3" />
          {saving ? "Saving\u2026" : "Save Draft"}
        </Button>
        <Button size="sm" onClick={onSaveComplete} disabled={saving}>
          <CheckCircle2 className="mr-1 size-3" />
          {saving ? "Saving\u2026" : "Submit as Complete"}
        </Button>
      </>
    )
  }

  if (isAdmin) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={onRevertToDraft ?? onSaveDraft}
        disabled={saving}
      >
        <RotateCcw className="mr-1 size-3" />
        {saving ? "Reverting\u2026" : "Revert to Draft"}
      </Button>
    )
  }

  return (
    <p className="text-xs text-muted-foreground">
      This {entityLabel} has been submitted as complete. Contact an admin to
      revert.
    </p>
  )
}
