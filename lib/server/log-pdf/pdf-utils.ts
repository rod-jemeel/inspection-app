import "server-only"
import { PDFDocument } from "pdf-lib"

export async function mergePdfBytes(parts: Uint8Array[]): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const merged = await PDFDocument.create()
  let pageCount = 0

  for (const part of parts) {
    const src = await PDFDocument.load(part)
    const pages = await merged.copyPages(src, src.getPageIndices())
    for (const page of pages) {
      merged.addPage(page)
      pageCount += 1
    }
  }

  return {
    bytes: await merged.save(),
    pageCount,
  }
}

export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes)
  return doc.getPageCount()
}

