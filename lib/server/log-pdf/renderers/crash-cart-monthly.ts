import "server-only"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { CrashCartLogData, CrashCartItem } from "@/lib/validations/log-entry"
import { CRASH_CART_ITEMS, MONTH_KEYS, TOP_OF_CART_ITEMS } from "@/lib/validations/log-entry"
import type { RecordRenderer, RenderJob } from "@/lib/server/log-pdf"
import { createDrawContext, drawText } from "@/lib/server/log-pdf/draw"
import { drawSignatureInBox } from "@/lib/server/log-pdf/renderers/_shared"
import type { RenderedPdfPart } from "@/lib/validations/log-export"

const PAGE_W = 612 // Letter portrait
const PAGE_H = 792
const FORM_GRAY_HEADER = 0.88
const FORM_GRAY_SECTION = 0.9

const TABLE_X = 30
const TABLE_W = 552
const LABEL_W = 196
const PAR_W = 26
const EXP_W = 54
const MONTH_W = 23
const COL_X = {
  label: TABLE_X,
  par: TABLE_X + LABEL_W,
  exp: TABLE_X + LABEL_W + PAR_W,
  months: TABLE_X + LABEL_W + PAR_W + EXP_W,
}

type Ctx = ReturnType<typeof createDrawContext>

type GridRow =
  | { kind: "item"; item: CrashCartItem }
  | { kind: "section"; label: string }
  | { kind: "completed" }

const ITEM_BY_KEY = new Map(CRASH_CART_ITEMS.map((item) => [item.key, item]))

function getItem(key: string): CrashCartItem {
  const item = ITEM_BY_KEY.get(key)
  if (!item) throw new Error(`Crash cart item not found: ${key}`)
  return item
}

function itemRange(fromKey: string, toKey: string): CrashCartItem[] {
  const start = CRASH_CART_ITEMS.findIndex((x) => x.key === fromKey)
  const end = CRASH_CART_ITEMS.findIndex((x) => x.key === toKey)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Invalid crash cart item range: ${fromKey}..${toKey}`)
  }
  return CRASH_CART_ITEMS.slice(start, end + 1)
}

function rowsFromItems(items: CrashCartItem[]): GridRow[] {
  return items.map((item) =>
    item.section ? { kind: "section", label: item.label } : { kind: "item", item }
  )
}

const PAGE1_ROWS: GridRow[] = [
  ...rowsFromItems(itemRange("adenosine", "midazolam")),
  { kind: "section", label: getItem("section_second_drawer").label },
  ...rowsFromItems(itemRange("lidocaine_2_syr", "saline_flush")),
]

const PAGE2_ROWS: GridRow[] = [
  ...rowsFromItems(itemRange("tourniquet", "iv_catheters_20g")),
  { kind: "section", label: getItem("section_third_drawer").label },
  ...rowsFromItems(itemRange("iv_tubing", "nasal_cannula")),
  { kind: "section", label: getItem("section_fifth_drawer").label },
  ...rowsFromItems(itemRange("lube", "curved_blade_mac_4")),
]

const PAGE3_UPPER_ROWS: GridRow[] = [
  ...rowsFromItems(itemRange("single_use_straight_blade", "straight_blade_mill_3")),
  { kind: "section", label: getItem("section_sixth_drawer").label },
  ...rowsFromItems(itemRange("ambu_bag", "suction_yankauer")),
  { kind: "completed" },
]

function isCheckValue(value: unknown): boolean {
  if (typeof value !== "string") return false
  const v = value.trim().toLowerCase()
  return v === "x" || v === "check" || v === "checked" || v === "yes" || v === "true" || v === "✓"
}

function py(ctx: Ctx, y: number) {
  return ctx.pageHeight - y
}

function drawHLine(ctx: Ctx, x1: number, x2: number, y: number, thickness = 0.6) {
  const yy = py(ctx, y)
  ctx.page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness })
}

function drawVLine(ctx: Ctx, x: number, y1: number, y2: number, thickness = 0.6) {
  ctx.page.drawLine({
    start: { x, y: py(ctx, y1) },
    end: { x, y: py(ctx, y2) },
    thickness,
  })
}

function fillRect(ctx: Ctx, x: number, y: number, width: number, height: number, gray = 0.94) {
  ctx.page.drawRectangle({
    x,
    y: py(ctx, y + height),
    width,
    height,
    color: rgb(gray, gray, gray),
  })
}

function strokeRect(ctx: Ctx, x: number, y: number, width: number, height: number, thickness = 0.8) {
  drawHLine(ctx, x, x + width, y, thickness)
  drawHLine(ctx, x, x + width, y + height, thickness)
  drawVLine(ctx, x, y, y + height, thickness)
  drawVLine(ctx, x + width, y, y + height, thickness)
}

function drawCircleDot(ctx: Ctx, x: number, y: number, r = 1.7) {
  ctx.page.drawCircle({
    x,
    y: py(ctx, y),
    size: r,
    color: rgb(0, 0, 0),
  })
}

function drawCheckMark(ctx: Ctx, x: number, y: number, width: number, height: number, thickness = 0.9) {
  const p1 = { x: x + width * 0.2, y: py(ctx, y + height * 0.58) }
  const p2 = { x: x + width * 0.42, y: py(ctx, y + height * 0.78) }
  const p3 = { x: x + width * 0.8, y: py(ctx, y + height * 0.28) }
  ctx.page.drawLine({ start: p1, end: p2, thickness })
  ctx.page.drawLine({ start: p2, end: p3, thickness })
}

function drawFormTitle(ctx: Ctx, year: number, titleFontBold: import("pdf-lib").PDFFont) {
  drawText(ctx, "South Loop Endoscopy Center", {
    x: 0,
    y: 44,
    width: PAGE_W,
    font: titleFontBold,
    size: 16,
    align: "center",
  })
  drawText(ctx, "Crash Cart Monthly Checklist", {
    x: 0,
    y: 73,
    width: PAGE_W,
    font: titleFontBold,
    size: 15,
    align: "center",
  })
  void year
}

function drawInstructionsAndYearRow(
  ctx: Ctx,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont },
  year: number
) {
  const { font, fontBold } = fonts
  const y = 96
  const instructionsH = 30
  const yearH = 22

  fillRect(ctx, TABLE_X, y, TABLE_W, instructionsH, FORM_GRAY_HEADER)
  strokeRect(ctx, TABLE_X, y, TABLE_W, instructionsH + yearH, 0.8)
  drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, y + instructionsH, 0.7)

  drawText(
    ctx,
    "Instructions: Each month identify how many of each item is in stock. Verify each item is within the manufacturer's expiration or open medication is within 28 days.",
    {
      x: TABLE_X + 10,
      y: y + 9,
      width: TABLE_W - 20,
      font,
      size: 6.2,
      align: "center",
      maxLength: 170,
    }
  )
  drawText(
    ctx,
    "Initial on the last row of each month. Complete the name section at the bottom.",
    {
      x: TABLE_X + 10,
      y: y + 18,
      width: TABLE_W - 20,
      font,
      size: 6.2,
      align: "center",
      maxLength: 120,
    }
  )

  const yearLabelCellW = 130
  drawVLine(ctx, TABLE_X + yearLabelCellW, y + instructionsH, y + instructionsH + yearH, 0.6)
  drawText(ctx, "Year:", {
    x: TABLE_X + 8,
    y: y + instructionsH + 7,
    width: yearLabelCellW - 16,
    font,
    size: 8,
    align: "center",
  })
  drawText(ctx, String(year), {
    x: TABLE_X + yearLabelCellW,
    y: y + instructionsH + 5,
    width: TABLE_W - yearLabelCellW,
    font: fontBold,
    size: 11,
    align: "center",
  })
}

function drawGridColumns(
  ctx: Ctx,
  yTop: number,
  totalHeight: number,
  opts?: { includeOuter?: boolean }
) {
  if (opts?.includeOuter !== false) strokeRect(ctx, TABLE_X, yTop, TABLE_W, totalHeight, 0.8)

  drawVLine(ctx, COL_X.par, yTop, yTop + totalHeight, 0.5)
  drawVLine(ctx, COL_X.exp, yTop, yTop + totalHeight, 0.5)
  drawVLine(ctx, COL_X.months, yTop, yTop + totalHeight, 0.5)

  for (let i = 1; i < 12; i++) {
    drawVLine(ctx, COL_X.months + i * MONTH_W, yTop, yTop + totalHeight, 0.45)
  }
}

function drawGridHeader(
  ctx: Ctx,
  y: number,
  headerLeftLabel: string,
  fonts: { fontBold: import("pdf-lib").PDFFont }
) {
  fillRect(ctx, TABLE_X, y, TABLE_W, 22, FORM_GRAY_HEADER)
  strokeRect(ctx, TABLE_X, y, TABLE_W, 22, 0.8)
  drawGridColumns(ctx, y, 22, { includeOuter: false })

  drawText(ctx, headerLeftLabel, {
    x: TABLE_X + 4,
    y: y + 6,
    width: LABEL_W - 8,
    font: fonts.fontBold,
    size: 7.4,
    align: "center",
    maxLength: 28,
  })

  const headers = ["Par", "Exp", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const starts = [
    COL_X.par,
    COL_X.exp,
    ...MONTH_KEYS.map((_, i) => COL_X.months + i * MONTH_W),
  ]
  const widths = [PAR_W, EXP_W, ...Array.from({ length: 12 }, () => MONTH_W)]

  headers.forEach((label, idx) => {
    drawText(ctx, label, {
      x: starts[idx] + 2,
      y: y + 6,
      width: widths[idx] - 4,
      font: fonts.fontBold,
      size: 7.2,
      align: "center",
      maxLength: 8,
    })
  })
}

function drawMonthCellValue(
  ctx: Ctx,
  value: unknown,
  x: number,
  y: number,
  width: number,
  height: number,
  font: import("pdf-lib").PDFFont
) {
  if (isCheckValue(value)) {
    drawCheckMark(ctx, x + 4.5, y + 4, width - 9, height - 8, 0.8)
    return
  }
  drawText(ctx, value ?? "", {
    x: x + 2,
    y: y + 6,
    width: width - 4,
    font,
    size: 6.4,
    align: "center",
    maxLength: 6,
  })
}

function drawBodyRows(
  ctx: Ctx,
  rows: GridRow[],
  yStart: number,
  rowH: number,
  job: RenderJob<CrashCartLogData>,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont }
) {
  const { font, fontBold } = fonts
  const bodyH = rows.length * rowH

  strokeRect(ctx, TABLE_X, yStart, TABLE_W, bodyH, 0.8)
  drawGridColumns(ctx, yStart, bodyH, { includeOuter: false })

  for (let i = 1; i < rows.length; i++) {
    drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, yStart + i * rowH, 0.45)
  }

  rows.forEach((row, idx) => {
    const y = yStart + idx * rowH
    const fillInset = 0.35

    if (row.kind === "section") {
      fillRect(
        ctx,
        TABLE_X + fillInset,
        y + fillInset,
        TABLE_W - fillInset * 2,
        rowH - fillInset * 2,
        FORM_GRAY_SECTION
      )
      drawGridColumns(ctx, y, rowH, { includeOuter: false })
      drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, y, 0.45)
      drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, y + rowH, 0.45)
      drawText(ctx, row.label, {
        x: TABLE_X + 5,
        y: y + Math.max(4, rowH / 2 - 3),
        width: LABEL_W - 10,
        font: fontBold,
        size: 7.2,
        align: "center",
        maxLength: 30,
      })
      return
    }

    if (row.kind === "completed") {
      fillRect(
        ctx,
        TABLE_X + fillInset,
        y + fillInset,
        LABEL_W - fillInset * 2,
        rowH - fillInset * 2,
        FORM_GRAY_SECTION
      )
      drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, y, 0.45)
      drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, y + rowH, 0.45)
      drawText(ctx, "Completed by (Initials)", {
        x: TABLE_X + 6,
        y: y + Math.max(4, rowH / 2 - 3),
        width: LABEL_W - 12,
        font: fontBold,
        size: 7.2,
        align: "left",
        maxLength: 28,
      })
      MONTH_KEYS.forEach((m, mIdx) => {
        drawMonthCellValue(
          ctx,
          job.data.completed_by?.[m] ?? "",
          COL_X.months + mIdx * MONTH_W,
          y,
          MONTH_W,
          rowH,
          font
        )
      })
      return
    }

    const item = row.item
    const labelX = TABLE_X + (item.indent ? 26 : 8)
    drawText(ctx, item.label, {
      x: labelX,
      y: y + Math.max(4, rowH / 2 - 3),
      width: LABEL_W - (item.indent ? 34 : 14),
      font,
      size: 7.0,
      align: item.indent ? "left" : "left",
      maxLength: item.indent ? 22 : 34,
    })

    drawText(ctx, job.data.par?.[item.key] ?? "", {
      x: COL_X.par + 2,
      y: y + 5,
      width: PAR_W - 4,
      font,
      size: 6.6,
      align: "center",
      maxLength: 4,
    })
    drawText(ctx, job.data.exp?.[item.key] ?? "", {
      x: COL_X.exp + 2,
      y: y + 5,
      width: EXP_W - 4,
      font,
      size: 6.2,
      align: "center",
      maxLength: 8,
    })

    MONTH_KEYS.forEach((m, mIdx) => {
      drawMonthCellValue(
        ctx,
        job.data.months?.[m]?.[item.key] ?? "",
        COL_X.months + mIdx * MONTH_W,
        y,
        MONTH_W,
        rowH,
        font
      )
    })
  })
}

async function drawTopOfCartSection(
  args: {
    ctx: Ctx
    outDoc: PDFDocument
    job: RenderJob<CrashCartLogData>
    renderCtx: Parameters<RecordRenderer["render"]>[1]
    fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont }
    y: number
  }
) {
  const { ctx, outDoc, job, renderCtx, fonts, y } = args
  const { font, fontBold } = fonts

  const headerH = 22
  const checkRowH = 16
  const sigHeaderH = 22
  const sigRowH = 20
  const topRows = TOP_OF_CART_ITEMS.length
  const sigRows = 3
  const totalH = headerH + topRows * checkRowH + sigHeaderH + sigRows * sigRowH

  strokeRect(ctx, TABLE_X, y, TABLE_W, totalH, 0.8)

  // Main header
  fillRect(ctx, TABLE_X, y, TABLE_W, headerH, FORM_GRAY_HEADER)
  drawText(ctx, "TOP OF CRASH CART", {
    x: TABLE_X,
    y: y + 6,
    width: TABLE_W,
    font: fontBold,
    size: 8.5,
    align: "center",
  })
  drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, y + headerH, 0.7)

  // Checklist rows
  const checkX = TABLE_X
  const checkColW = 26
  const labelColW = TABLE_W - checkColW
  drawVLine(ctx, checkX + checkColW, y + headerH, y + headerH + topRows * checkRowH, 0.5)

  TOP_OF_CART_ITEMS.forEach((item, idx) => {
    const rowY = y + headerH + idx * checkRowH
    if (idx > 0) drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, rowY, 0.45)

    // checkbox mark cell
    if (job.data.top_of_cart?.[item.key]) {
      drawCheckMark(ctx, checkX + 7, rowY + 3.5, 12, 10, 1.0)
    }

    // printed bullet + label in paper form
    drawCircleDot(ctx, checkX + checkColW + 6, rowY + checkRowH / 2 + 0.3, 1.4)
    drawText(ctx, item.label, {
      x: checkX + checkColW + 12,
      y: rowY + 4.5,
      width: labelColW - 16,
      font,
      size: 6.8,
      maxLength: 48,
    })
  })
  const checksBottomY = y + headerH + topRows * checkRowH
  drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, checksBottomY, 0.7)

  // Signature table
  const sigY = checksBottomY
  fillRect(ctx, TABLE_X, sigY, TABLE_W, sigHeaderH, FORM_GRAY_HEADER)
  drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, sigY + sigHeaderH, 0.7)

  const sigCols = [116, 112, 48, 116, 112, 48]
  const sigXs: number[] = [TABLE_X]
  for (const w of sigCols) sigXs.push(sigXs[sigXs.length - 1] + w)
  for (let i = 1; i < sigXs.length - 1; i++) {
    drawVLine(ctx, sigXs[i], sigY, sigY + sigHeaderH + sigRows * sigRowH, 0.5)
  }
  for (let r = 1; r <= sigRows; r++) {
    drawHLine(ctx, TABLE_X, TABLE_X + TABLE_W, sigY + sigHeaderH + r * sigRowH, 0.45)
  }

  const sigHeaders = ["Name", "Signature", "Initials", "Name", "Signature", "Initials"]
  sigHeaders.forEach((label, idx) => {
    drawText(ctx, label, {
      x: sigXs[idx] + 2,
      y: sigY + 6,
      width: sigCols[idx] - 4,
      font: fontBold,
      size: 7.2,
      align: "center",
      maxLength: 16,
    })
  })

  const sigs = (job.data.signatures ?? []).slice(0, 6)
  for (let idx = 0; idx < 6; idx++) {
    const sig = sigs[idx]
    const colGroup = idx < 3 ? 0 : 1
    const row = idx % 3
    const rowY = sigY + sigHeaderH + row * sigRowH
    const groupOffset = colGroup === 0 ? 0 : 3
    const xName = sigXs[groupOffset]
    const xSig = sigXs[groupOffset + 1]
    const xInit = sigXs[groupOffset + 2]

    drawText(ctx, `${idx + 1}.`, {
      x: xName + 5,
      y: rowY + 5.5,
      width: 14,
      font,
      size: 6.8,
    })

    if (sig) {
      drawText(ctx, sig.name ?? "", {
        x: xName + 18,
        y: rowY + 5.5,
        width: sigCols[groupOffset] - 22,
        font,
        size: 6.5,
        maxLength: 24,
      })
      drawText(ctx, sig.initials ?? "", {
        x: xInit + 2,
        y: rowY + 5.5,
        width: sigCols[groupOffset + 2] - 4,
        font,
        size: 6.8,
        align: "center",
        maxLength: 4,
      })
      await drawSignatureInBox({
        outDoc,
        renderCtx,
        signatureValue: sig.signature,
        pageCtx: ctx,
        x: xSig + 4,
        y: rowY + 2.5,
        width: sigCols[groupOffset + 1] - 8,
        height: sigRowH - 5,
      })
    }
  }
}

function drawPageNumber(
  ctx: Ctx,
  pageIndex: number,
  fontBold: import("pdf-lib").PDFFont
) {
  drawText(ctx, `Page ${pageIndex + 1} of 3`, {
    x: 0,
    y: 746,
    width: PAGE_W,
    font: fontBold,
    size: 9,
    align: "center",
  })
}

export const crashCartMonthlyRenderer: RecordRenderer<RenderJob<CrashCartLogData>> = {
  async render(job, renderCtx): Promise<RenderedPdfPart> {
    const out = await PDFDocument.create()
    const [font, fontBold, titleFontBold] = await Promise.all([
      out.embedFont(StandardFonts.Helvetica),
      out.embedFont(StandardFonts.HelveticaBold),
      out.embedFont(StandardFonts.TimesRomanBold),
    ])

    const fonts = { font, fontBold }

    // Page 1
    {
      const page = out.addPage([PAGE_W, PAGE_H])
      const ctx = createDrawContext(page, { debug: renderCtx.debug })
      drawFormTitle(ctx, job.data.year, titleFontBold)
      drawInstructionsAndYearRow(ctx, fonts, job.data.year)

      const headerY = 96 + 30 + 22
      drawGridHeader(ctx, headerY, "First Drawer", { fontBold })
      const bodyY = headerY + 22
      const rowH = 19
      drawBodyRows(ctx, PAGE1_ROWS, bodyY, rowH, job, fonts)
      drawPageNumber(ctx, 0, fontBold)
    }

    // Page 2
    {
      const page = out.addPage([PAGE_W, PAGE_H])
      const ctx = createDrawContext(page, { debug: renderCtx.debug })
      drawFormTitle(ctx, job.data.year, titleFontBold)

      const headerY = 108
      drawGridHeader(ctx, headerY, "Second Drawer Cont", { fontBold })
      const bodyY = headerY + 22
      const rowH = 17.9
      drawBodyRows(ctx, PAGE2_ROWS, bodyY, rowH, job, fonts)
      drawPageNumber(ctx, 1, fontBold)
    }

    // Page 3
    {
      const page = out.addPage([PAGE_W, PAGE_H])
      const ctx = createDrawContext(page, { debug: renderCtx.debug })
      drawFormTitle(ctx, job.data.year, titleFontBold)

      const headerY = 108
      drawGridHeader(ctx, headerY, "Fifth Drawer Cont", { fontBold })
      const bodyY = headerY + 22
      const rowH = 17.9
      drawBodyRows(ctx, PAGE3_UPPER_ROWS, bodyY, rowH, job, fonts)
      const upperBottomY = bodyY + PAGE3_UPPER_ROWS.length * rowH

      await drawTopOfCartSection({
        ctx,
        outDoc: out,
        job,
        renderCtx,
        fonts,
        y: upperBottomY + 16,
      })

      drawPageNumber(ctx, 2, fontBold)
    }

    return {
      bytes: await out.save(),
      pageCount: out.getPageCount(),
      description: `Crash cart monthly ${job.entry.log_key}`,
    }
  },
}
