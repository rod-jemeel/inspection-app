import "server-only"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { CRASH_CART_DAILY_ITEMS, type CrashCartDailyLogData } from "@/lib/validations/log-entry"
import type { RecordRenderer, RenderJob } from "@/lib/server/log-pdf"
import { createDrawContext, drawText } from "@/lib/server/log-pdf/draw"
import { drawSignatureInBox } from "@/lib/server/log-pdf/renderers/_shared"
import type { RenderedPdfPart } from "@/lib/validations/log-export"

const PAGE_W = 792 // Letter landscape
const PAGE_H = 612

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const CHECK_ITEMS = CRASH_CART_DAILY_ITEMS
type Ctx = ReturnType<typeof createDrawContext>

function py(ctx: Ctx, y: number) {
  return ctx.pageHeight - y
}

function drawHLine(ctx: Ctx, x1: number, x2: number, y: number, thickness = 0.6) {
  const yy = py(ctx, y)
  ctx.page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness })
}

function drawVLine(ctx: Ctx, x: number, y1: number, y2: number, thickness = 0.6) {
  ctx.page.drawLine({ start: { x, y: py(ctx, y1) }, end: { x, y: py(ctx, y2) }, thickness })
}

function strokeRect(ctx: Ctx, x: number, y: number, w: number, h: number, t = 0.8) {
  drawHLine(ctx, x, x + w, y, t)
  drawHLine(ctx, x, x + w, y + h, t)
  drawVLine(ctx, x, y, y + h, t)
  drawVLine(ctx, x + w, y, y + h, t)
}

function drawCheckMark(ctx: Ctx, x: number, y: number, w: number, h: number, thickness = 0.9) {
  const p1 = { x: x + w * 0.2, y: py(ctx, y + h * 0.58) }
  const p2 = { x: x + w * 0.42, y: py(ctx, y + h * 0.78) }
  const p3 = { x: x + w * 0.8, y: py(ctx, y + h * 0.26) }
  ctx.page.drawLine({ start: p1, end: p2, thickness })
  ctx.page.drawLine({ start: p2, end: p3, thickness })
}

function isMarked(value: unknown): boolean {
  if (typeof value !== "string") return false
  const v = value.trim().toLowerCase()
  return v === "x" || v === "check" || v === "checked" || v === "yes" || v === "true" || v === "✓" || v === "âœ“"
}

function monthLength(year: number, monthName: string): number {
  const monthIndex = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ].indexOf(String(monthName || "").toLowerCase())
  if (monthIndex === -1) return 31
  return new Date(year, monthIndex + 1, 0).getDate()
}

function drawMainGrid(
  ctx: Ctx,
  job: RenderJob<CrashCartDailyLogData>,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont }
) {
  const { font, fontBold } = fonts
  const x = 8
  const y = 62
  const tableW = PAGE_W - x * 2 // 776
  const itemW = 220
  const dayW = 15
  const notesW = tableW - itemW - dayW * 31 // 91
  const rowYear = 22
  const rowHeader = 18
  const rowCheck = 27
  const rowLock = 20
  const rowInitials = 18
  const checkRows = CHECK_ITEMS.length
  const totalH = rowYear + rowHeader + checkRows * rowCheck + 3 * rowLock + rowInitials
  const daysX = x + itemW
  const notesX = daysX + 31 * dayW

  strokeRect(ctx, x, y, tableW, totalH, 0.8)

  // Outer verticals
  drawVLine(ctx, daysX, y, y + totalH, 0.6)
  for (let i = 1; i < 31; i++) {
    drawVLine(ctx, daysX + i * dayW, y + rowYear, y + totalH, 0.4)
  }
  drawVLine(ctx, notesX, y, y + totalH, 0.6)

  // Horizontal row lines
  let cursorY = y
  drawHLine(ctx, x, x + tableW, cursorY + rowYear, 0.6)
  cursorY += rowYear
  drawHLine(ctx, x, x + tableW, cursorY + rowHeader, 0.6)
  cursorY += rowHeader
  for (let i = 0; i < checkRows; i++) {
    drawHLine(ctx, x, x + tableW, cursorY + rowCheck, 0.4)
    cursorY += rowCheck
  }
  for (let i = 0; i < 3; i++) {
    // The paper form merges the left "Last 3 digits of lock #" label across 3 rows.
    // Keep internal dividers only on the day/notes side for the first two lock rows.
    drawHLine(
      ctx,
      i < 2 ? daysX : x,
      x + tableW,
      cursorY + rowLock,
      0.4
    )
    cursorY += rowLock
  }
  drawHLine(ctx, x, x + tableW, cursorY + rowInitials, 0.6)

  // Year/Month merged row
  const yearRowY = y
  const yearLabelSplit = x + 88
  const monthCellStart = x + 472
  const monthLabelSplit = monthCellStart + 78
  drawVLine(ctx, yearLabelSplit, yearRowY, yearRowY + rowYear, 0.5)
  drawVLine(ctx, monthCellStart, yearRowY, yearRowY + rowYear, 0.6)
  drawVLine(ctx, monthLabelSplit, yearRowY, yearRowY + rowYear, 0.5)

  drawText(ctx, "Year:", { x: x + 8, y: yearRowY + 7, width: 68, font: fontBold, size: 7.2, align: "left" })
  drawText(ctx, String(job.data.year), {
    x: yearLabelSplit + 10,
    y: yearRowY + 6,
    width: monthCellStart - yearLabelSplit - 16,
    font: font,
    size: 8.2,
    align: "left",
  })
  drawText(ctx, "Month:", {
    x: monthCellStart + 5,
    y: yearRowY + 7,
    width: monthLabelSplit - monthCellStart - 10,
    font: fontBold,
    size: 7.2,
    align: "center",
  })
  drawText(ctx, job.data.month ?? "", {
    x: monthLabelSplit + 4,
    y: yearRowY + 6,
    width: x + tableW - monthLabelSplit - 8,
    font,
    size: 8.2,
    align: "left",
    maxLength: 16,
  })

  // Header row
  const headerY = y + rowYear
  drawHLine(ctx, x, x + tableW, headerY, 0.6)
  drawHLine(ctx, x, x + tableW, headerY + rowHeader, 0.6)
  drawVLine(ctx, daysX, headerY, headerY + rowHeader, 0.6)
  for (let i = 1; i < 31; i++) {
    drawVLine(ctx, daysX + i * dayW, headerY, headerY + rowHeader, 0.4)
  }
  drawVLine(ctx, notesX, headerY, headerY + rowHeader, 0.6)
  drawText(ctx, "Item", {
    x: x + 4,
    y: headerY + 6,
    width: itemW - 8,
    font: fontBold,
    size: 7.0,
    align: "center",
  })
  DAYS.forEach((day, idx) => {
    drawText(ctx, String(day), {
      x: daysX + idx * dayW + 1,
      y: headerY + 5.8,
      width: dayW - 2,
      font: fontBold,
      size: 6.3,
      align: "center",
      maxLength: 2,
    })
  })
  drawText(ctx, "Notes", {
    x: notesX + 2,
    y: headerY + 6,
    width: notesW - 4,
    font: fontBold,
    size: 6.8,
    align: "center",
  })

  // Check rows (7)
  const checksStartY = headerY + rowHeader
  CHECK_ITEMS.forEach((item, rowIdx) => {
    const rowY = checksStartY + rowIdx * rowCheck
    drawText(ctx, item.label, {
      x: x + 5,
      y: rowY + 7,
      width: itemW - 10,
      font,
      size: 6.8,
      maxLength: 50,
    })

    for (let day = 1; day <= 31; day++) {
      const cellX = daysX + (day - 1) * dayW
      const v = job.data.checks?.[item.key]?.[String(day)] ?? ""
      if (!v) continue
      if (isMarked(v)) {
        drawCheckMark(ctx, cellX + 2.6, rowY + 8.2, dayW - 5.2, rowCheck - 15.4, 0.85)
      } else {
        drawText(ctx, v, {
          x: cellX + 1,
          y: rowY + 8.5,
          width: dayW - 2,
          font,
          size: 5.8,
          align: "center",
          maxLength: 2,
        })
      }
    }

    const noteValue = job.data.notes?.[item.key] ?? ""
    drawText(ctx, noteValue, {
      x: notesX + 2,
      y: rowY + 7,
      width: notesW - 4,
      font,
      size: 6.1,
      maxLength: 26,
    })
  })

  // Lock digits section (3 rows) with merged left label
  const lockStartY = checksStartY + checkRows * rowCheck
  const lockLabelH = rowLock * 3
  void lockLabelH
  drawText(ctx, "Last 3 digits of", {
    x: x + 5,
    y: lockStartY + 20,
    width: itemW - 10,
    font: fontBold,
    size: 6.6,
    maxLength: 20,
  })
  drawText(ctx, "lock #", {
    x: x + 5,
    y: lockStartY + 31,
    width: itemW - 10,
    font: fontBold,
    size: 6.6,
    maxLength: 10,
  })

  for (let r = 0; r < 3; r++) {
    const rowY = lockStartY + r * rowLock
    for (let day = 1; day <= 31; day++) {
      drawText(ctx, job.data.lock_digits?.[r]?.[String(day)] ?? "", {
        x: daysX + (day - 1) * dayW + 1,
        y: rowY + 6.5,
        width: dayW - 2,
        font,
        size: 6.5,
        align: "center",
        maxLength: 2,
      })
    }
  }

  // Initials row
  const initialsY = lockStartY + 3 * rowLock
  drawText(ctx, "Initials", {
    x: x + 5,
    y: initialsY + 6,
    width: itemW - 10,
    font: fontBold,
    size: 6.8,
    align: "left",
  })
  const mLen = monthLength(job.data.year, job.data.month)
  for (let day = 1; day <= 31; day++) {
    if (day > mLen) continue
    drawText(ctx, job.data.initials?.[String(day)] ?? "", {
      x: daysX + (day - 1) * dayW + 0.5,
      y: initialsY + 6,
      width: dayW - 1,
      font,
      size: 5.5,
      align: "center",
      maxLength: 4,
    })
  }
}

async function drawBottomSections(
  ctx: Ctx,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont },
  job: RenderJob<CrashCartDailyLogData>,
  outDoc: PDFDocument,
  renderCtx: Parameters<RecordRenderer["render"]>[1]
) {
  const { font, fontBold } = fonts
  const x = 8
  const fullW = PAGE_W - x * 2 // 776
  const leftW = 430
  const rightW = fullW - leftW

  // Row of labels + lock numbers table (side-by-side)
  const topY = 374
  const leftRowH = 18
  const leftRows = [
    "AED unit - area clean without spills, clear access to controls",
    "Pad/Cable - package intact",
    "Supplies On AED",
    "Crash Cart Seal Intact - checked and serial number recorded (if changed)",
  ]
  const leftH = leftRows.length * leftRowH
  for (let i = 1; i <= leftRows.length; i++) {
    drawHLine(ctx, x, x + leftW, topY + i * leftRowH, 0.45)
  }
  leftRows.forEach((label, i) => {
    drawText(ctx, label, {
      x: x + 5,
      y: topY + i * leftRowH + 6,
      width: leftW - 10,
      font,
      size: 6.4,
      maxLength: 80,
    })
  })

  const rx = x + leftW
  const rTopH = 18
  const rHdrH = 22
  const rRowH = 24
  const rTotalH = rTopH + rHdrH + 2 * rRowH
  const topBlockH = Math.max(leftH, rTotalH)

  // Signature table (4 entries: 2 rows x 2 sides)
  const sigGap = 6
  const sigHeaderH = 20
  const sigRowH = 22
  const sigRows = 2
  const sigTotalH = sigHeaderH + sigRows * sigRowH
  const sigY = topY + topBlockH + sigGap

  // Notes box
  const notesH = 36
  const notesY = sigY + sigTotalH
  const bottomTotalH = notesY + notesH - topY

  // One combined bottom container; inner sections only draw dividers.
  strokeRect(ctx, x, topY, fullW, bottomTotalH, 0.8)

  // Top block left/right split divider (labels vs lock numbers)
  drawVLine(ctx, rx, topY, topY + topBlockH, 0.8)

  drawText(ctx, "Crash Cart Lock Numbers", {
    x: rx,
    y: topY + 6,
    width: rightW,
    font: fontBold,
    size: 7.4,
    align: "center",
  })
  drawHLine(ctx, rx, rx + rightW, topY + rTopH, 0.6)
  drawHLine(ctx, rx, rx + rightW, topY + rTopH + rHdrH, 0.6)
  drawHLine(ctx, rx, rx + rightW, topY + rTopH + rHdrH + rRowH, 0.45)
  drawHLine(ctx, x, x + fullW, topY + topBlockH, 0.6)

  const c1 = 116
  const c2 = 57
  const c3 = 116
  const c4 = rightW - c1 - c2 - c3
  const rxs = [rx, rx + c1, rx + c1 + c2, rx + c1 + c2 + c3, rx + rightW]
  for (let i = 1; i < rxs.length - 1; i++) drawVLine(ctx, rxs[i], topY + rTopH, topY + rTotalH, 0.5)

  const lockHdrs = ["Date Changed &\nReason", "New Lock #", "Date Changed &\nReason", "New Lock #"]
  ;[c1, c2, c3, c4].forEach((w, i) => {
    const label = lockHdrs[i]
    const parts = label.split("\n")
    if (parts.length === 1) {
      drawText(ctx, parts[0], { x: rxs[i] + 2, y: topY + rTopH + 8, width: w - 4, font: fontBold, size: 6.2, align: "center" })
    } else {
      drawText(ctx, parts[0], { x: rxs[i] + 2, y: topY + rTopH + 5.5, width: w - 4, font: fontBold, size: 5.9, align: "center" })
      drawText(ctx, parts[1], { x: rxs[i] + 2, y: topY + rTopH + 13, width: w - 4, font: fontBold, size: 5.9, align: "center" })
    }
  })

  const changes = job.data.lock_changes ?? []
  const pairs: Array<[typeof changes[number] | undefined, typeof changes[number] | undefined]> = [
    [changes[0], changes[1]],
    [changes[2], changes[3]],
  ]
  pairs.forEach((pair, rowIdx) => {
    const rowY = topY + rTopH + rHdrH + rowIdx * rRowH
    drawText(ctx, pair[0]?.date_reason ?? "", { x: rxs[0] + 3, y: rowY + 6, width: c1 - 6, font, size: 5.8, maxLength: 34 })
    drawText(ctx, pair[0]?.new_lock ?? "", { x: rxs[1] + 2, y: rowY + 6, width: c2 - 4, font, size: 6.1, align: "center", maxLength: 12 })
    drawText(ctx, pair[1]?.date_reason ?? "", { x: rxs[2] + 3, y: rowY + 6, width: c3 - 6, font, size: 5.8, maxLength: 34 })
    drawText(ctx, pair[1]?.new_lock ?? "", { x: rxs[3] + 2, y: rowY + 6, width: c4 - 4, font, size: 6.1, align: "center", maxLength: 12 })
  })

  // Signature table (4 entries: 2 rows x 2 sides)
  drawHLine(ctx, x, x + fullW, sigY, 0.6)
  drawHLine(ctx, x, x + fullW, sigY + sigHeaderH, 0.6)
  drawHLine(ctx, x, x + fullW, sigY + sigHeaderH + sigRowH, 0.45)
  drawHLine(ctx, x, x + fullW, sigY + sigTotalH, 0.6)

  // Give signature columns more width while keeping the full table width fixed.
  const sigCols = [28, 158, 150, 52, 28, 158, 150, 52]
  const sigXs: number[] = [x]
  for (const w of sigCols) sigXs.push(sigXs[sigXs.length - 1] + w)
  for (let i = 1; i < sigXs.length - 1; i++) drawVLine(ctx, sigXs[i], sigY, sigY + sigTotalH, 0.5)

  const headers = ["", "Name", "Signature", "Initials", "", "Name", "Signature", "Initials"]
  headers.forEach((h, i) => {
    if (!h) return
    drawText(ctx, h, {
      x: sigXs[i] + 2,
      y: sigY + 6,
      width: sigCols[i] - 4,
      font: fontBold,
      size: 6.8,
      align: "center",
    })
  })

  const sigs = (job.data.signatures ?? []).slice(0, 4)
  for (let idx = 0; idx < 4; idx++) {
    const sig = sigs[idx]
    const group = idx < 2 ? 0 : 1
    const row = idx % 2
    const base = group === 0 ? 0 : 4
    const rowY = sigY + sigHeaderH + row * sigRowH

    drawText(ctx, `${idx + 1}.`, {
      x: sigXs[base] + 3,
      y: rowY + 6.5,
      width: sigCols[base] - 6,
      font,
      size: 6.3,
      align: "left",
    })
    if (!sig) continue

    drawText(ctx, sig.name ?? "", {
      x: sigXs[base + 1] + 3,
      y: rowY + 6.5,
      width: sigCols[base + 1] - 6,
      font,
      size: 6.2,
      maxLength: 28,
    })
    drawText(ctx, sig.initials ?? "", {
      x: sigXs[base + 3] + 2,
      y: rowY + 6.5,
      width: sigCols[base + 3] - 4,
      font,
      size: 6.2,
      align: "center",
      maxLength: 4,
    })
    await drawSignatureInBox({
      outDoc,
      renderCtx,
      signatureValue: sig.signature,
      pageCtx: ctx,
      x: sigXs[base + 2] + 6,
      y: rowY + 3,
      width: sigCols[base + 2] - 12,
      height: sigRowH - 6,
    })
  }

  // Notes row inside combined container
  drawText(ctx, "Notes:", { x: x + 5, y: notesY + 7, width: 35, font: fontBold, size: 6.8 })
  drawText(ctx, job.data.bottom_notes ?? "", {
    x: x + 40,
    y: notesY + 7,
    width: fullW - 46,
    font,
    size: 6.1,
    maxLength: 230,
  })
}

export const crashCartDailyRenderer: RecordRenderer<RenderJob<CrashCartDailyLogData>> = {
  async render(job, renderCtx): Promise<RenderedPdfPart> {
    const out = await PDFDocument.create()
    const [font, fontBold, titleFont] = await Promise.all([
      out.embedFont(StandardFonts.Helvetica),
      out.embedFont(StandardFonts.HelveticaBold),
      out.embedFont(StandardFonts.TimesRoman),
    ])

    const page = out.addPage([PAGE_W, PAGE_H])
    const ctx = createDrawContext(page, { debug: renderCtx.debug })

    // Title + underline (paper style)
    drawText(ctx, "Crash Cart Daily Checklist", {
      x: 0,
      y: 24,
      width: PAGE_W,
      font: titleFont,
      size: 18,
      align: "center",
    })

    drawMainGrid(ctx, job, { font, fontBold })
    await drawBottomSections(ctx, { font, fontBold }, job, out, renderCtx)

    return {
      bytes: await out.save(),
      pageCount: 1,
      description: `Crash cart daily ${job.entry.log_key}`,
    }
  },
}
