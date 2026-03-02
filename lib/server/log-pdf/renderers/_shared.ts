import "server-only"
import { PDFDocument, StandardFonts } from "pdf-lib"
import type { RenderContext } from "@/lib/server/log-pdf"
import { createDrawContext, drawDebugBox, drawImageBox } from "@/lib/server/log-pdf/draw"
import { embedSignatureAsset } from "@/lib/server/log-pdf"
import type { RenderedPdfPart } from "@/lib/validations/log-export"

export async function renderTemplatePages(
  opts: {
    templateBytes: Uint8Array
    pageCount: number
    description: string
    visualRotation?: 0 | 90 | 180 | 270
    drawPage: (args: {
      outDoc: PDFDocument
      outPageIndex: number
      page: import("pdf-lib").PDFPage
      font: import("pdf-lib").PDFFont
      fontBold: import("pdf-lib").PDFFont
      ctx: ReturnType<typeof createDrawContext>
    }) => Promise<void> | void
  },
  renderCtx: RenderContext
): Promise<RenderedPdfPart> {
  const source = await PDFDocument.load(opts.templateBytes)
  const out = await PDFDocument.create()
  const [font, fontBold] = await Promise.all([
    out.embedFont(StandardFonts.Helvetica),
    out.embedFont(StandardFonts.HelveticaBold),
  ])

  for (let i = 0; i < opts.pageCount; i++) {
    const sourceIndex = Math.min(i, source.getPageCount() - 1)
    const [page] = await out.copyPages(source, [sourceIndex])
    out.addPage(page)
    const ctx = createDrawContext(page, {
      visualRotation: opts.visualRotation ?? 0,
      debug: renderCtx.debug,
    })
    await opts.drawPage({ outDoc: out, outPageIndex: i, page, font, fontBold, ctx })
  }

  return {
    bytes: await out.save(),
    pageCount: out.getPageCount(),
    description: opts.description,
  }
}

export async function drawSignatureInBox(params: {
  outDoc: PDFDocument
  renderCtx: RenderContext
  signatureValue: string | null | undefined
  pageCtx: ReturnType<typeof createDrawContext>
  x: number
  y: number
  width: number
  height: number
}) {
  const asset = await params.renderCtx.signatureResolver.resolve(params.signatureValue)
  const image = await embedSignatureAsset(params.outDoc, asset)
  if (!image) {
    drawDebugBox(params.pageCtx, params.x, params.y, params.width, params.height)
    return false
  }
  drawImageBox(params.pageCtx, image, {
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
  })
  drawDebugBox(params.pageCtx, params.x, params.y, params.width, params.height)
  return true
}
