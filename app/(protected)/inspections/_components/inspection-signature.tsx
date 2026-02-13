"use client"

import { PenTool } from "lucide-react"

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

interface Signature {
  id: string
  signed_at: string
  signed_by_profile_id: string
  signature_image_path: string
  signer_name: string | null
}

interface InspectionSignatureSectionProps {
  instance: Instance
  signatures: Signature[]
  canSign: boolean
  showSignature: boolean
  locationId: string
  onShowSignature: (show: boolean) => void
  onSignatureSave: (data: { imageBlob: Blob; points: unknown; signerName: string }) => void
  loading: boolean
}

// Date formatter
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

export function InspectionSignatureSection({
  instance,
  signatures,
  locationId,
}: InspectionSignatureSectionProps) {
  const formatDate = (dateString: string) => {
    return dateTimeFormatter.format(new Date(dateString))
  }

  if (signatures.length === 0) {
    return null
  }

  return (
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
              <span className="font-medium">{sig.signer_name || "Signed"}</span>
              <span className="text-muted-foreground">· {formatDate(sig.signed_at)}</span>
            </div>
            <div className="flex justify-center rounded border bg-white p-2">
              <img
                src={`/api/locations/${locationId}/instances/${instance.id}/sign/${sig.id}/image`}
                alt={`Signature by ${sig.signer_name || "Inspector"}`}
                width={300}
                height={96}
                className="h-24 w-auto max-w-full object-contain"
                loading="lazy"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
