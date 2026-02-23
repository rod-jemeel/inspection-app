"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { InitialsAudit } from "@/lib/validations/log-entry"

interface InitialsAuditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  audit: InitialsAudit | null | undefined
  title?: string
}

export function InitialsAuditDialog({
  open,
  onOpenChange,
  audit,
  title = "Initials Signature Audit",
}: InitialsAuditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>

        {!audit ? (
          <p className="text-xs text-muted-foreground">
            No signature audit data is available for this initials stamp.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="border border-border rounded p-2 bg-muted/10 flex items-center justify-center min-h-[80px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={audit.sig}
                alt="Drawn signature"
                className="max-h-28 w-auto object-contain"
              />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground font-medium">Signed by</dt>
              <dd className="font-medium">{audit.signer_name || "—"}</dd>
              <dt className="text-muted-foreground font-medium">Date &amp; time</dt>
              <dd>
                {audit.signed_at
                  ? new Date(audit.signed_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "—"}
              </dd>
              {audit.signer_profile_id && (
                <>
                  <dt className="text-muted-foreground font-medium">Profile ID</dt>
                  <dd className="truncate" title={audit.signer_profile_id}>
                    {audit.signer_profile_id}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

