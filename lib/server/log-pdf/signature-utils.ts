import "server-only"
import { supabase } from "@/lib/server/db"
import type { SignatureAsset } from "@/lib/validations/log-export"

function inferMimeType(bytes: Uint8Array): "image/png" | "image/jpeg" {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png"
  }
  return "image/jpeg"
}

function parseDataUrl(value: string): SignatureAsset | null {
  const match = /^data:(image\/png|image\/jpeg|image\/jpg);base64,(.+)$/i.exec(value)
  if (!match) return null
  const bytes = new Uint8Array(Buffer.from(match[2], "base64"))
  return {
    bytes,
    mimeType: match[1].toLowerCase() === "image/png" ? "image/png" : "image/jpeg",
    source: "data-url",
  }
}

export interface SignatureResolver {
  warnings: string[]
  resolve(value: string | null | undefined): Promise<SignatureAsset | null>
  resolveAuditSig(value: unknown): Promise<SignatureAsset | null>
}

export function createSignatureResolver(): SignatureResolver {
  const warnings: string[] = []
  const cache = new Map<string, SignatureAsset | null>()

  async function resolveStoragePath(path: string): Promise<SignatureAsset | null> {
    const cached = cache.get(path)
    if (cached !== undefined) return cached

    try {
      const bucket = process.env.SIGNATURES_BUCKET ?? "signatures"
      const { data, error } = await supabase.storage.from(bucket).download(path)
      if (error || !data) {
        warnings.push(`Signature download failed: ${path}`)
        cache.set(path, null)
        return null
      }
      const bytes = new Uint8Array(await data.arrayBuffer())
      const asset: SignatureAsset = { bytes, mimeType: inferMimeType(bytes), source: "supabase-path" }
      cache.set(path, asset)
      return asset
    } catch {
      warnings.push(`Signature resolution failed: ${path}`)
      cache.set(path, null)
      return null
    }
  }

  return {
    warnings,
    async resolve(value) {
      if (!value) return null
      if (value.startsWith("data:image/")) return parseDataUrl(value)
      return resolveStoragePath(value)
    },
    async resolveAuditSig(value) {
      if (!value || typeof value !== "object") return null
      const sig = (value as { sig?: unknown }).sig
      if (typeof sig !== "string") return null
      return sig.startsWith("data:image/") ? parseDataUrl(sig) : null
    },
  }
}

