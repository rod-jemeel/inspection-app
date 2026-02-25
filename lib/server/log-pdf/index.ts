import type { PDFDocument } from "pdf-lib"
import type { LogEntry } from "@/lib/server/services/log-entries"
import type { RenderedPdfPart } from "@/lib/validations/log-export"
import { createSignatureResolver, type SignatureResolver } from "@/lib/server/log-pdf/signature-utils"

export interface RenderContext {
  debug?: boolean
  signatureResolver: SignatureResolver
}

export interface RenderJob<TData = Record<string, unknown>> {
  entry: LogEntry
  data: TData
}

export interface InventoryRenderJob<TData = Record<string, unknown>> extends RenderJob<TData> {
  drugSlug: string
  filteredRows: Array<Record<string, unknown>>
  carryForwardStock: number | null
  dateFrom: string
  dateTo: string
}

export interface RecordRenderer<TJob = RenderJob> {
  render(job: TJob, ctx: RenderContext): Promise<RenderedPdfPart>
}

export function createRenderContext(debug = false): RenderContext {
  return {
    debug,
    signatureResolver: createSignatureResolver(),
  }
}

export async function embedSignatureAsset(
  doc: PDFDocument,
  asset: Awaited<ReturnType<SignatureResolver["resolve"]>>
) {
  if (!asset) return null
  return asset.mimeType === "image/png" ? doc.embedPng(asset.bytes) : doc.embedJpg(asset.bytes)
}

