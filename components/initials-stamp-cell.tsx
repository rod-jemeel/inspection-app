"use client"

import { useState } from "react"
import { Eye, Loader2, PenLine, X } from "lucide-react"
import { toast } from "sonner"
import { FullscreenSignaturePad } from "@/components/fullscreen-signature-pad"
import { InitialsAuditDialog } from "@/components/initials-audit-dialog"
import { cn } from "@/lib/utils"
import { blobToDataUrl, buildInitialsAudit, deriveStampedInitials } from "@/lib/initials-stamp-utils"
import type { MySignatureProfile } from "@/hooks/use-my-signature"
import type { InitialsAudit } from "@/lib/validations/log-entry"

export interface InitialsStampResult {
  initials: string
  audit: InitialsAudit
  signer: {
    name: string
    initials: string
    signature: string
  }
}

interface InitialsStampCellProps {
  value: string
  audit?: InitialsAudit | null
  locationId?: string
  disabled?: boolean
  className?: string
  slotLabel?: string
  profile?: MySignatureProfile | null
  onStamp: (payload: InitialsStampResult) => void
  onClear: () => void
}

export function InitialsStampCell({
  value,
  audit,
  locationId,
  disabled,
  className,
  slotLabel = "Initials",
  profile,
  onStamp,
  onClear,
}: InitialsStampCellProps) {
  const [signing, setSigning] = useState(false)
  const [viewingAudit, setViewingAudit] = useState(false)
  const [processing, setProcessing] = useState(false)

  const hasValue = value.trim() !== ""
  const isLegacyStamp = hasValue && !audit

  async function handleSaveSignature({
    imageBlob,
    signerName,
  }: {
    imageBlob: Blob
    points: unknown
    signerName: string
  }) {
    setProcessing(true)
    try {
      const initials = deriveStampedInitials({
        signerName,
        profileDefaultInitials: profile?.default_initials,
      })

      if (!initials) {
        toast.error("Initials unavailable. Set profile initials or enter a valid signer name.")
        return
      }

      const signatureDataUrl = await blobToDataUrl(imageBlob)
      const stampAudit = buildInitialsAudit({
        signatureDataUrl,
        signerName,
        signerProfileId: profile?.profile_id,
      })

      onStamp({
        initials,
        audit: stampAudit,
        signer: {
          name: signerName,
          initials,
          signature: signatureDataUrl,
        },
      })

      setSigning(false)
    } catch {
      toast.error("Failed to save initials stamp")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          "flex h-8 md:h-9 items-center justify-center gap-1",
          className,
        )}
      >
        {hasValue ? (
          <>
            <span
              className="select-none text-[11px] md:text-xs font-medium leading-none"
              title={isLegacyStamp ? `${slotLabel} (legacy stamp, no audit)` : slotLabel}
            >
              {value}
            </span>
            {audit && (
              <button
                type="button"
                onClick={() => setViewingAudit(true)}
                className="inline-flex size-5 md:size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors touch-manipulation"
                title={`View ${slotLabel} audit`}
                disabled={disabled && !audit}
              >
                <Eye className="size-3 md:size-3.5" />
              </button>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex size-5 md:size-6 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
                title={`Clear ${slotLabel}`}
              >
                <X className="size-3 md:size-3.5" />
              </button>
            )}
          </>
        ) : !disabled ? (
          <button
            type="button"
            onClick={() => setSigning(true)}
            className="inline-flex size-6 md:size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors touch-manipulation"
            title={`Sign to stamp ${slotLabel}`}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="size-3.5 md:size-4 animate-spin" />
            ) : (
              <PenLine className="size-3.5 md:size-4" />
            )}
          </button>
        ) : (
          <div className="h-6" />
        )}
      </div>

      <InitialsAuditDialog
        open={viewingAudit}
        onOpenChange={setViewingAudit}
        audit={audit}
        title={`${slotLabel} Audit`}
        locationId={locationId}
      />

      {signing && (
        <FullscreenSignaturePad
          title={`Sign to stamp ${slotLabel}`}
          description="Draw your signature to confirm this initials stamp."
          defaultSignerName={profile?.name ?? ""}
          disabled={processing}
          onCancel={() => {
            if (!processing) setSigning(false)
          }}
          onSave={handleSaveSignature}
        />
      )}
    </>
  )
}
