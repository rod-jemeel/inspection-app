import type { InitialsAudit } from "@/lib/validations/log-entry"

interface DeriveInitialsInput {
  signerName: string
  profileDefaultInitials?: string | null
}

export function deriveStampedInitials({
  signerName,
  profileDefaultInitials,
}: DeriveInitialsInput): string | null {
  const preferred = profileDefaultInitials?.trim()
  if (preferred) return preferred.toUpperCase().slice(0, 5)

  const derived = signerName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 5)

  return derived || null
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Failed to convert signature image"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read signature image"))
    reader.readAsDataURL(blob)
  })
}

export function buildInitialsAudit(input: {
  signatureDataUrl: string
  signerName: string
  signerProfileId?: string
}): InitialsAudit {
  return {
    sig: input.signatureDataUrl,
    signed_at: new Date().toISOString(),
    signer_name: input.signerName,
    ...(input.signerProfileId ? { signer_profile_id: input.signerProfileId } : {}),
  }
}

