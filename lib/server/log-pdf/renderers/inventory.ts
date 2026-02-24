import "server-only"
import { PDFDocument, StandardFonts } from "pdf-lib"
import type { InventoryLogData } from "@/lib/validations/log-entry"
import type { InventoryRenderJob, RecordRenderer } from "@/lib/server/log-pdf"
import { createDrawContext, drawText } from "@/lib/server/log-pdf/draw"
import { drawSignatureInBox } from "@/lib/server/log-pdf/renderers/_shared"
import type { RenderedPdfPart } from "@/lib/validations/log-export"

const ROWS_PER_PAGE = 7
const PAGE_WIDTH = 792 // letter landscape
const PAGE_HEIGHT = 612

type ColDef = {
  key:
    | "date"
    | "ordered_by"
    | "transaction"
    | "qty_in_stock"
    | "amt_ordered"
    | "amt_used"
    | "amt_wasted"
    | "rn"
    | "witness"
  label: string
  width: number
  align?: "left" | "center" | "right"
}

const COLUMNS: ColDef[] = [
  { key: "date", label: "DATE", width: 70, align: "center" },
  { key: "ordered_by", label: "MD/ CRNA OR\nPATIENT NAME", width: 120 },
  { key: "transaction", label: "TRANSACTION", width: 110 },
  { key: "qty_in_stock", label: "QTY. IN\nSTOCK", width: 60, align: "center" },
  { key: "amt_ordered", label: "AMT.\nORDERED", width: 60, align: "center" },
  { key: "amt_used", label: "AMT. USED", width: 60, align: "center" },
  { key: "amt_wasted", label: "AMT.\nWASTED", width: 60, align: "center" },
  { key: "rn", label: "RN SIGNATURE", width: 110 },
  { key: "witness", label: "WITNESS", width: 110 },
]

function chunkRows(rows: Array<Record<string, unknown>>) {
  const chunks: Array<Array<Record<string, unknown>>> = []
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    chunks.push(rows.slice(i, i + ROWS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])
  return chunks
}

function drawRectTop(ctx: ReturnType<typeof createDrawContext>, x: number, y: number, w: number, h: number, lineWidth = 0.8) {
  drawHLine(ctx, x, x + w, y, lineWidth)
  drawHLine(ctx, x, x + w, y + h, lineWidth)
  drawVLine(ctx, x, y, y + h, lineWidth)
  drawVLine(ctx, x + w, y, y + h, lineWidth)
}

function drawDiagInCell(ctx: ReturnType<typeof createDrawContext>, x: number, y: number, w: number, h: number, thickness = 0.5) {
  ctx.page.drawLine({
    // Slight inset so the slash does not merge into table borders.
    // Paper form diagonal runs top-right -> bottom-left.
    start: { x: x + w - 1.5, y: ctx.pageHeight - (y + 1.5) },
    end: { x: x + 1.5, y: ctx.pageHeight - (y + h - 1.5) },
    thickness,
  })
}

function drawHLine(ctx: ReturnType<typeof createDrawContext>, x1: number, x2: number, y: number, thickness = 0.6) {
  const py = ctx.pageHeight - y
  ctx.page.drawLine({ start: { x: x1, y: py }, end: { x: x2, y: py }, thickness })
}

function drawVLine(ctx: ReturnType<typeof createDrawContext>, x: number, y1: number, y2: number, thickness = 0.6) {
  ctx.page.drawLine({
    start: { x, y: ctx.pageHeight - y1 },
    end: { x, y: ctx.pageHeight - y2 },
    thickness,
  })
}

function cellXPositions(startX: number) {
  const xs: number[] = [startX]
  for (const col of COLUMNS) xs.push(xs[xs.length - 1] + col.width)
  return xs
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export const inventoryRenderer: RecordRenderer<InventoryRenderJob<InventoryLogData>> = {
  async render(job, renderCtx): Promise<RenderedPdfPart> {
    const chunks = chunkRows(job.filteredRows)
    const doc = await PDFDocument.create()
    const [font, fontBold] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
    ])

    for (let pageIndex = 0; pageIndex < chunks.length; pageIndex++) {
      const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      const ctx = createDrawContext(page, { debug: renderCtx.debug })
      const marginX = 16
      const contentW = PAGE_WIDTH - marginX * 2

      // Header
      drawText(ctx, "South Loop Endoscopy & Wellness Center", {
        x: marginX,
        y: 30,
        width: contentW,
        font: fontBold,
        size: 16,
        align: "center",
      })
      drawText(ctx, "Controlled Substances Perpetual Inventory Form", {
        x: marginX,
        y: 52,
        width: contentW,
        font: fontBold,
        size: 12,
        align: "center",
      })

      // Drug / Strength / Size line fields (closer to paper form)
      const d = job.data
      const fieldY = 82
      drawText(ctx, "DRUG:", { x: marginX, y: fieldY, font, size: 9 })
      drawText(ctx, "STRENGTH", { x: marginX + 327, y: fieldY, font, size: 9 })
      drawText(ctx, "SIZE", { x: marginX + 470, y: fieldY, font, size: 9 })
      drawHLine(ctx, marginX + 34, marginX + 303, fieldY + 10, 0.6)
      drawHLine(ctx, marginX + 380, marginX + 455, fieldY + 10, 0.6)
      drawHLine(ctx, marginX + 497, marginX + 590, fieldY + 10, 0.6)
      drawText(ctx, d.drug_name || job.drugSlug, {
        x: marginX + 38,
        y: fieldY - 7,
        width: 260,
        font,
        size: 10,
        maxLength: 42,
      })
      drawText(ctx, d.strength, {
        x: marginX + 384,
        y: fieldY - 7,
        width: 68,
        font,
        size: 10,
        align: "center",
        maxLength: 16,
      })
      drawText(ctx, d.size_qty, {
        x: marginX + 501,
        y: fieldY - 7,
        width: 86,
        font,
        size: 10,
        align: "center",
        maxLength: 16,
      })

      // Table geometry
      const tableW = COLUMNS.reduce((sum, c) => sum + c.width, 0)
      const tableX = Math.round((PAGE_WIDTH - tableW) / 2)
      const tableY = 102
      const headerH = 32
      const rowH = 58
      const tableH = headerH + ROWS_PER_PAGE * rowH
      const xs = cellXPositions(tableX)

      drawRectTop(ctx, tableX, tableY, tableW, tableH, 0.9)
      for (let i = 1; i < xs.length - 1; i++) drawVLine(ctx, xs[i], tableY, tableY + tableH, 0.5)
      drawHLine(ctx, tableX, tableX + tableW, tableY + headerH, 0.7)
      for (let i = 1; i < ROWS_PER_PAGE; i++) {
        drawHLine(ctx, tableX, tableX + tableW, tableY + headerH + i * rowH, 0.4)
      }

      // Table headers
      COLUMNS.forEach((col, i) => {
        const parts = col.label.split("\n")
        const headerFontSize = parts.length > 1 ? 6.4 : 6.8
        const headerTextTopNudge = -2
        if (parts.length === 1) {
          const y = tableY + (headerH - headerFontSize) / 2 + headerTextTopNudge
          drawText(ctx, col.label, {
            x: xs[i] + 2,
            y,
            width: col.width - 4,
            font: fontBold,
            size: headerFontSize,
            align: "center",
            maxLength: 22,
          })
        } else {
          const lineGap = 2
          const totalTextH = headerFontSize * 2 + lineGap
          const y1 = tableY + (headerH - totalTextH) / 2 + headerTextTopNudge
          const y2 = y1 + headerFontSize + lineGap
          drawText(ctx, parts[0], {
            x: xs[i] + 2,
            y: y1,
            width: col.width - 4,
            font: fontBold,
            size: headerFontSize,
            align: "center",
            maxLength: 22,
          })
          drawText(ctx, parts[1], {
            x: xs[i] + 2,
            y: y2,
            width: col.width - 4,
            font: fontBold,
            size: headerFontSize,
            align: "center",
            maxLength: 22,
          })
        }
      })

      // Rows
      const pageRows = chunks[pageIndex]
      let runningStock = pageIndex === 0 ? (job.carryForwardStock ?? d.initial_stock ?? null) : null
      for (let rIdx = 0; rIdx < ROWS_PER_PAGE; rIdx++) {
        const row = pageRows[rIdx]
        const top = tableY + headerH + rIdx * rowH
        if (!row) continue

        // Text cells
        drawText(ctx, row.date, {
          x: xs[0] + 3, y: top + 18, width: COLUMNS[0].width - 6, font, size: 8, align: "center", maxLength: 12,
        })
        drawText(ctx, row.patient_name, {
          x: xs[1] + 4, y: top + 16, width: COLUMNS[1].width - 8, font, size: 8, maxLength: 26,
        })
        drawText(ctx, row.transaction, {
          x: xs[2] + 4, y: top + 16, width: COLUMNS[2].width - 8, font, size: 8, maxLength: 22,
        })
        drawDiagInCell(ctx, xs[3], top, COLUMNS[3].width, rowH, 0.5)
        const previousStock = runningStock
        const currentStock = num(row.qty_in_stock)
        drawText(ctx, previousStock ?? "", {
          x: xs[3] + 4,
          y: top + 12,
          width: 18,
          font,
          size: 8,
          align: "left",
        })
        drawText(ctx, currentStock ?? row.qty_in_stock, {
          x: xs[3] + COLUMNS[3].width - 22,
          y: top + 43,
          width: 16,
          font,
          size: 8,
          align: "right",
        })
        drawText(ctx, row.amt_ordered, {
          x: xs[4] + 2, y: top + 18, width: COLUMNS[4].width - 4, font, size: 8, align: "center",
        })
        drawText(ctx, row.amt_used, {
          x: xs[5] + 2, y: top + 18, width: COLUMNS[5].width - 4, font, size: 8, align: "center",
        })
        drawText(ctx, row.amt_wasted, {
          x: xs[6] + 2, y: top + 18, width: COLUMNS[6].width - 4, font, size: 8, align: "center",
        })

        // RN cell (signature first, fallback to printed name)
        await drawSignatureInBox({
          outDoc: doc,
          renderCtx,
          signatureValue: row.rn_sig as string | null | undefined,
          pageCtx: ctx,
          x: xs[7] + 4,
          y: top + 7,
          width: COLUMNS[7].width - 8,
          height: rowH - 14,
        })
        if (!row.rn_sig && row.rn_name) {
          drawText(ctx, row.rn_name, {
            x: xs[7] + 4, y: top + 27, width: COLUMNS[7].width - 8, font, size: 8, align: "center", maxLength: 22,
          })
        }

        // Witness cell (signature first, fallback to printed name)
        await drawSignatureInBox({
          outDoc: doc,
          renderCtx,
          signatureValue: row.witness_sig as string | null | undefined,
          pageCtx: ctx,
          x: xs[8] + 4,
          y: top + 7,
          width: COLUMNS[8].width - 8,
          height: rowH - 14,
        })
        if (!row.witness_sig && row.witness_name) {
          drawText(ctx, row.witness_name, {
            x: xs[8] + 4, y: top + 27, width: COLUMNS[8].width - 8, font, size: 8, align: "center", maxLength: 22,
          })
        }

        runningStock = currentStock ?? runningStock
      }

      // Footer note like paper form
      drawText(ctx, "Effective January 2025", {
        x: marginX,
        y: PAGE_HEIGHT - 20,
        width: 120,
        font,
        size: 7,
      })
      if (chunks.length > 1) {
        drawText(ctx, `Page ${pageIndex + 1}/${chunks.length}`, {
          x: PAGE_WIDTH - marginX - 80,
          y: PAGE_HEIGHT - 20,
          width: 80,
          font,
          size: 7,
          align: "right",
        })
      }
    }

    return {
      bytes: await doc.save(),
      pageCount: doc.getPageCount(),
      description: `Inventory ${job.drugSlug} ${job.dateFrom}-${job.dateTo}`,
    }
  },
}
