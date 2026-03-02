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

function StampActionButton({
  title,
  onClick,
  disabled,
  destructive = false,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded text-muted-foreground transition-colors touch-manipulation",
        "size-5 md:size-6",
        destructive
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted/30 hover:text-foreground"
      )}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function StampValueView({
  value,
  slotLabel,
  audit,
  disabled,
  isLegacyStamp,
  onViewAudit,
  onClear,
}: {
  value: string
  slotLabel: string
  audit?: InitialsAudit | null
  disabled?: boolean
  isLegacyStamp: boolean
  onViewAudit: () => void
  onClear: () => void
}) {
  return (
    <>
      <span
        className="select-none text-[11px] font-medium leading-none md:text-xs"
        title={isLegacyStamp ? `${slotLabel} (legacy stamp, no audit)` : slotLabel}
      >
        {value}
      </span>
      {audit && (
        <StampActionButton
          title={`View ${slotLabel} audit`}
          onClick={onViewAudit}
          disabled={disabled && !audit}
        >
          <Eye className="size-3 md:size-3.5" />
        </StampActionButton>
      )}
      {!disabled && (
        <StampActionButton
          title={`Clear ${slotLabel}`}
          onClick={onClear}
          destructive
        >
          <X className="size-3 md:size-3.5" />
        </StampActionButton>
      )}
    </>
  )
}

function EmptyStampButton({
  slotLabel,
  processing,
  onClick,
}: {
  slotLabel: string
  processing: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-6 touch-manipulation items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground md:size-7"
      title={`Sign to stamp ${slotLabel}`}
      disabled={processing}
    >
      {processing ? (
        <Loader2 className="size-3.5 animate-spin md:size-4" />
      ) : (
        <PenLine className="size-3.5 md:size-4" />
      )}
    </button>
  )
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
          <StampValueView
            value={value}
            slotLabel={slotLabel}
            audit={audit}
            disabled={disabled}
            isLegacyStamp={isLegacyStamp}
            onViewAudit={() => setViewingAudit(true)}
            onClear={onClear}
          />
        ) : !disabled ? (
          <EmptyStampButton
            slotLabel={slotLabel}
            processing={processing}
            onClick={() => setSigning(true)}
          />
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
