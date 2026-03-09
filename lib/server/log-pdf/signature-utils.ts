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

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function extractSignatureReference(value: unknown, seen = new WeakSet<object>()): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  if (!value || typeof value !== "object") {
    return null
  }

  if (seen.has(value)) {
    return null
  }
  seen.add(value)

  const objectValue = value as Record<string, unknown>
  for (const key of ["sig", "signature", "signatureBase64", "image", "value", "storagePath", "path", "url"]) {
    const nested = extractSignatureReference(objectValue[key], seen)
    if (nested) {
      return nested
    }
  }

  return null
}

export interface SignatureResolver {
  warnings: string[]
  resolve(value: unknown): Promise<SignatureAsset | null>
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

  async function resolveRemoteUrl(url: string): Promise<SignatureAsset | null> {
    const cached = cache.get(url)
    if (cached !== undefined) return cached

    try {
      const response = await fetch(url)
      if (!response.ok) {
        warnings.push(`Signature download failed: ${url}`)
        cache.set(url, null)
        return null
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      const contentType = response.headers.get("content-type")?.toLowerCase()
      const asset: SignatureAsset = {
        bytes,
        mimeType: contentType?.includes("png") ? "image/png" : inferMimeType(bytes),
        source: "supabase-path",
      }
      cache.set(url, asset)
      return asset
    } catch {
      warnings.push(`Signature resolution failed: ${url}`)
      cache.set(url, null)
      return null
    }
  }

  return {
    warnings,
    async resolve(value) {
      const reference = extractSignatureReference(value)
      if (!reference) return null
      if (reference.startsWith("data:image/")) return parseDataUrl(reference)
      if (isHttpUrl(reference)) return resolveRemoteUrl(reference)
      return resolveStoragePath(reference)
    },
    async resolveAuditSig(value) {
      return this.resolve(value)
    },
  }
}
