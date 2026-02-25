import "server-only"
import { PDFDocument, StandardFonts } from "pdf-lib"
import type { NarcoticLogData } from "@/lib/validations/log-entry"
import type { RecordRenderer, RenderJob } from "@/lib/server/log-pdf"
import type { RenderedPdfPart } from "@/lib/validations/log-export"
import { createDrawContext, drawText } from "@/lib/server/log-pdf/draw"
import { drawSignatureInBox } from "@/lib/server/log-pdf/renderers/_shared"

const ROWS_PER_PAGE = 12

export const narcoticLogRenderer: RecordRenderer<RenderJob<NarcoticLogData>> = {
  async render(job, renderCtx): Promise<RenderedPdfPart> {
    const rowChunks: Array<NonNullable<NarcoticLogData["rows"]>> = []
    const rows = job.data.rows ?? []
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) rowChunks.push(rows.slice(i, i + ROWS_PER_PAGE))
    if (rowChunks.length === 0) rowChunks.push([])

    // No paper PDF template was provided for this form in docs/pdf forms; render a generated layout.
    const doc = await PDFDocument.create()
    const [font, fontBold] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
    ])

    for (let p = 0; p < rowChunks.length; p++) {
      const page = doc.addPage([792, 612])
      const ctx = createDrawContext(page, { debug: renderCtx.debug })
      drawText(ctx, "Narcotic Log (Generated)", { x: 24, y: 28, font: fontBold, size: 15 })
      drawText(ctx, `Date: ${job.entry.log_date}`, { x: 24, y: 48, font, size: 9 })
      drawText(ctx, `Status: ${job.entry.status}`, { x: 132, y: 48, font, size: 9 })
      drawText(ctx, `Page ${p + 1}/${rowChunks.length}`, { x: 710, y: 28, width: 60, font, size: 8, align: "right" })
      drawText(ctx, `Drug 3: ${job.data.drug3_name || "-"}`, { x: 250, y: 48, font, size: 9, width: 220 })

      if (p === 0) {
        drawText(ctx, `Beginning Count`, { x: 24, y: 72, font: fontBold, size: 9 })
        drawText(ctx, `Versed ${job.data.beginning_count?.versed ?? "-"}`, { x: 24, y: 88, font, size: 8 })
        drawText(ctx, `Fentanyl ${job.data.beginning_count?.fentanyl ?? "-"}`, { x: 115, y: 88, font, size: 8 })
        drawText(ctx, `Drug3 ${job.data.beginning_count?.drug3 ?? "-"}`, { x: 215, y: 88, font, size: 8 })
        await drawSignatureInBox({ outDoc: doc, renderCtx, signatureValue: job.data.header_sig1, pageCtx: ctx, x: 520, y: 65, width: 110, height: 22 })
        await drawSignatureInBox({ outDoc: doc, renderCtx, signatureValue: job.data.header_sig2, pageCtx: ctx, x: 642, y: 65, width: 110, height: 22 })
      }

      const headers = [
        ["Patient", 24, 180],
        ["V", 208, 34], ["V Waste", 246, 44],
        ["F", 294, 34], ["F Waste", 332, 44],
        ["D3", 380, 34], ["D3 Waste", 418, 50],
        ["Sig 1", 472, 138], ["Sig 2", 614, 138],
      ] as const
      headers.forEach(([label, x, w]) => drawText(ctx, label, { x, y: 114, width: w, font: fontBold, size: 8, align: "center" }))

      const y0 = 126
      const rowH = 35
      for (let i = 0; i < ROWS_PER_PAGE; i++) {
        const row = rowChunks[p][i]
        const y = y0 + i * rowH
        page.drawRectangle({ x: 20, y: page.getHeight() - (y + rowH - 2), width: 744, height: rowH - 2, borderWidth: 0.4 })
        if (!row) continue
        drawText(ctx, row.patient, { x: 24, y: y + 16, width: 180, font, size: 8, maxLength: 28 })
        drawText(ctx, row.versed, { x: 208, y: y + 16, width: 34, font, size: 8, align: "center" })
        drawText(ctx, row.versed_waste, { x: 246, y: y + 16, width: 44, font, size: 8, align: "center" })
        drawText(ctx, row.fentanyl, { x: 294, y: y + 16, width: 34, font, size: 8, align: "center" })
        drawText(ctx, row.fentanyl_waste, { x: 332, y: y + 16, width: 44, font, size: 8, align: "center" })
        drawText(ctx, row.drug3, { x: 380, y: y + 16, width: 34, font, size: 8, align: "center" })
        drawText(ctx, row.drug3_waste, { x: 418, y: y + 16, width: 50, font, size: 8, align: "center" })
        await drawSignatureInBox({ outDoc: doc, renderCtx, signatureValue: row.sig1, pageCtx: ctx, x: 474, y: y + 6, width: 136, height: 18 })
        await drawSignatureInBox({ outDoc: doc, renderCtx, signatureValue: row.sig2, pageCtx: ctx, x: 616, y: y + 6, width: 136, height: 18 })
      }

      if (p === rowChunks.length - 1) {
        const y = 560
        drawText(ctx, `End Count V:${job.data.end_count?.versed ?? "-"}  F:${job.data.end_count?.fentanyl ?? "-"}  D3:${job.data.end_count?.drug3 ?? "-"}`, { x: 24, y, font, size: 9, maxLength: 80 })
        drawText(ctx, `Waste Totals V:${job.data.end_count?.versed_total_waste ?? "-"}  F:${job.data.end_count?.fentanyl_total_waste ?? "-"}  D3:${job.data.end_count?.drug3_total_waste ?? "-"}`, { x: 24, y: y + 16, font, size: 8, maxLength: 90 })
        await drawSignatureInBox({ outDoc: doc, renderCtx, signatureValue: job.data.end_sig1, pageCtx: ctx, x: 520, y: 548, width: 110, height: 22 })
        await drawSignatureInBox({ outDoc: doc, renderCtx, signatureValue: job.data.end_sig2, pageCtx: ctx, x: 642, y: 548, width: 110, height: 22 })
      }
    }

    return {
      bytes: await doc.save(),
      pageCount: doc.getPageCount(),
      description: `Narcotic log ${job.entry.log_date}`,
    }
  },
}

