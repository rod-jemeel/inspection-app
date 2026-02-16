"use client"

import { useState, useEffect } from "react"
import { PenLine, X } from "lucide-react"
import { FullscreenSignaturePad } from "@/components/fullscreen-signature-pad"
import { cn } from "@/lib/utils"

interface SignatureCellProps {
  value: string | null
  onChange: (storagePath: string | null, base64: string | null) => void
  locationId: string
  disabled?: boolean
  className?: string
}

export function SignatureCell({
  value,
  onChange,
  locationId,
  disabled,
  className,
}: SignatureCellProps) {
  const [showPad, setShowPad] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [localBase64, setLocalBase64] = useState<string | null>(null)

  // Generate a signed preview URL for stored signatures
  useEffect(() => {
    if (!value || value.startsWith("data:")) {
      setPreviewUrl(value)
      return
    }

    // It's a storage path - fetch signed URL
    async function fetchSignedUrl() {
      try {
        const res = await fetch(
          `/api/locations/${locationId}/logs/signature-url?path=${encodeURIComponent(value!)}`
        )
        if (res.ok) {
          const { url } = await res.json()
          setPreviewUrl(url)
        }
      } catch {
        setPreviewUrl(null)
      }
    }
    fetchSignedUrl()
  }, [value, locationId])

  const handleSave = (result: { imageBlob: Blob; points: unknown; signerName: string }) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setLocalBase64(base64)
      setPreviewUrl(base64)
      onChange(null, base64)
    }
    reader.readAsDataURL(result.imageBlob)
    setShowPad(false)
  }

  const handleClear = () => {
    setLocalBase64(null)
    setPreviewUrl(null)
    onChange(null, null)
  }

  const displayUrl = localBase64 || previewUrl

  return (
    <>
      <div
        className={cn(
          "group/sig relative flex h-8 w-full items-center justify-center rounded-sm border border-border/60 bg-background transition-colors",
          !disabled && !displayUrl && "cursor-pointer hover:border-border hover:bg-muted/30",
          disabled && "opacity-50",
          className
        )}
        onClick={!disabled && !displayUrl ? () => setShowPad(true) : undefined}
      >
        {displayUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt="Signature"
              className="h-full w-full object-contain px-1 py-0.5"
            />
            {!disabled && (
              <button
                type="button"
                className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover/sig:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
              >
                <X className="size-2.5" />
              </button>
            )}
          </>
        ) : (
          <PenLine className="size-3.5 text-muted-foreground/40" />
        )}
      </div>

      {showPad && (
        <FullscreenSignaturePad
          onSave={handleSave}
          onCancel={() => setShowPad(false)}
          disabled={disabled}
          title="Sign Log Entry"
          description="Sign as licensed staff to verify this log entry."
        />
      )}
    </>
  )
}
