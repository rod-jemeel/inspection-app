import "server-only"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import {
  NARCOTIC_COUNT_DRUGS,
  type DailyNarcoticCountLogData,
  type NarcoticCountEntry,
} from "@/lib/validations/log-entry"
import type { RecordRenderer, RenderJob } from "@/lib/server/log-pdf"
import { embedSignatureAsset } from "@/lib/server/log-pdf"
import { createDrawContext, drawDebugBox, drawImageBox, drawText } from "@/lib/server/log-pdf/draw"
import { drawSignatureInBox } from "@/lib/server/log-pdf/renderers/_shared"
import type { RenderedPdfPart } from "@/lib/validations/log-export"

const PAGE_W = 792 // Letter landscape
const PAGE_H = 612

const FORM_X = 46
const FORM_W = 700
const TABLE_X = FORM_X
const TABLE_Y = 102
const LABEL_W = 214
const DATE_COLUMNS_PER_SECTION = 6
const SECTIONS_PER_PAGE = 2
const DATE_COLUMNS_PER_PAGE = DATE_COLUMNS_PER_SECTION * SECTIONS_PER_PAGE
const DATE_GROUP_W = (FORM_W - LABEL_W) / DATE_COLUMNS_PER_SECTION // 81
const AM_W = 24
const DIAG_W = 33
const PM_W = 24

const SECTION_DATE_H = 24
const SECTION_SUB_H = 24
const SECTION_DRUG_H = 29
const SECTION_INITIALS_H = 28
const SECTION_H = SECTION_DATE_H + SECTION_SUB_H + SECTION_DRUG_H * 3 + SECTION_INITIALS_H
const SECTION_GAP = 8

const TABLE_STACK_H = SECTION_H * 2 + SECTION_GAP
const SIG_TITLE_Y = TABLE_Y + TABLE_STACK_H + 16
const SIG_TABLE_Y = SIG_TITLE_Y + 16
const SIG_HEADER_H = 20
const SIG_ROW_H = 18
const SIG_TABLE_H = SIG_HEADER_H + SIG_ROW_H * 4

type Ctx = ReturnType<typeof createDrawContext>
type RenderCtx = Parameters<RecordRenderer["render"]>[1]
type CountSig = NonNullable<DailyNarcoticCountLogData["signatures"]>[number]
type EntryOrBlank = NarcoticCountEntry | null

function py(ctx: Ctx, y: number) {
  return ctx.pageHeight - y
}

function hLine(ctx: Ctx, x1: number, x2: number, y: number, t = 0.55) {
  const yy = py(ctx, y)
  ctx.page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: t })
}

function vLine(ctx: Ctx, x: number, y1: number, y2: number, t = 0.55) {
  ctx.page.drawLine({ start: { x, y: py(ctx, y1) }, end: { x, y: py(ctx, y2) }, thickness: t })
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, t = 0.7) {
  hLine(ctx, x, x + w, y, t)
  hLine(ctx, x, x + w, y + h, t)
  vLine(ctx, x, y, y + h, t)
  vLine(ctx, x + w, y, y + h, t)
}

function fillRect(ctx: Ctx, x: number, y: number, w: number, h: number, shade = 0.9) {
  ctx.page.drawRectangle({
    x,
    y: py(ctx, y) - h,
    width: w,
    height: h,
    color: rgb(shade, shade, shade),
  })
}

function drawDiag(ctx: Ctx, x: number, y: number, w: number, h: number, t = 0.45) {
  ctx.page.drawLine({
    start: { x: x + w, y: py(ctx, y) },
    end: { x, y: py(ctx, y + h) },
    thickness: t,
  })
}

function chunkEntries<T>(entries: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < entries.length; i += size) chunks.push(entries.slice(i, i + size))
  return chunks
}

function padSectionEntries(entries: NarcoticCountEntry[]): EntryOrBlank[] {
  const arr: EntryOrBlank[] = [...entries]
  while (arr.length < DATE_COLUMNS_PER_SECTION) arr.push(null)
  return arr
}

function monthNameFromKey(logKey?: string | null) {
  if (!logKey || !/^\d{4}-\d{2}$/.test(logKey)) return ""
  const [, monthStr] = logKey.split("-")
  const month = Number.parseInt(monthStr, 10)
  return new Date(2026, month - 1, 1).toLocaleDateString("en-US", { month: "long" })
}

function yearFromKey(logKey?: string | null) {
  if (!logKey || !/^\d{4}-\d{2}$/.test(logKey)) return null
  return Number.parseInt(logKey.slice(0, 4), 10)
}

function formatIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [y, m, d] = value.split("-")
  return `${m}/${d}/${y}`
}

function formatColumnDate(value: string) {
  if (!value) return ""
  return formatIsoDate(value)
}

function headerMeta(data: DailyNarcoticCountLogData, logKey?: string | null) {
  const fallbackYear = yearFromKey(logKey)
  const year = Number.isFinite(data.year) ? data.year : (fallbackYear ?? new Date().getFullYear())
  const monthLabel = data.month_label?.trim() || monthNameFromKey(logKey)
  return {
    monthLabel,
    year,
    yearSuffix: String(year).slice(-2),
    fromDate: data.from_date ? formatIsoDate(data.from_date) : "",
    toDate: data.to_date ? formatIsoDate(data.to_date) : "",
  }
}

function drawHeader(
  ctx: Ctx,
  data: DailyNarcoticCountLogData,
  entryLogKey: string | null | undefined,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont },
  pageIndex: number,
  pageCount: number
) {
  const { font, fontBold } = fonts
  const meta = headerMeta(data, entryLogKey)

  drawText(ctx, "SOUTH LOOP ENDOSCOPY & WELLNESS CENTER.", {
    x: 0,
    y: 30,
    width: PAGE_W,
    font: fontBold,
    size: 12,
    align: "center",
    maxLength: 60,
  })
  drawText(ctx, "DAILY NARCOTIC COUNT", {
    x: 0,
    y: 48,
    width: PAGE_W,
    font: fontBold,
    size: 10.5,
    align: "center",
    maxLength: 32,
  })

  const leftY = 74
  drawText(ctx, "For the month of", {
    x: FORM_X,
    y: leftY,
    width: 92,
    font: fontBold,
    size: 7.5,
  })
  hLine(ctx, FORM_X + 104, FORM_X + 220, leftY + 11, 0.4)
  drawText(ctx, meta.monthLabel, {
    x: FORM_X + 108,
    y: leftY - 2,
    width: 108,
    font,
    size: 8.8,
    maxLength: 18,
  })
  drawText(ctx, "20", { x: FORM_X + 226, y: leftY, width: 16, font: fontBold, size: 7.4 })
  hLine(ctx, FORM_X + 246, FORM_X + 272, leftY + 11, 0.4)
  drawText(ctx, meta.yearSuffix, {
    x: FORM_X + 248,
    y: leftY - 2,
    width: 20,
    font,
    size: 8.8,
    align: "center",
  })

  const rightX = FORM_X + 430
  drawText(ctx, "From date", { x: rightX, y: leftY, width: 44, font: fontBold, size: 7.5 })
  hLine(ctx, rightX + 50, rightX + 145, leftY + 11, 0.4)
  drawText(ctx, meta.fromDate, { x: rightX + 54, y: leftY - 2, width: 87, font, size: 8.5, maxLength: 12 })
  drawText(ctx, "To date", { x: rightX + 154, y: leftY, width: 34, font: fontBold, size: 7.5 })
  hLine(ctx, rightX + 194, FORM_X + FORM_W - 8, leftY + 11, 0.4)
  drawText(ctx, meta.toDate, {
    x: rightX + 198,
    y: leftY - 2,
    width: FORM_X + FORM_W - (rightX + 204),
    font,
    size: 8.5,
    maxLength: 12,
  })

  if (pageCount > 1) {
    drawText(ctx, `Page ${pageIndex + 1} of ${pageCount}`, {
      x: FORM_X,
      y: 18,
      width: FORM_W,
      font,
      size: 6.8,
      align: "right",
      maxLength: 16,
    })
  }
}

function drawSubheaderDiagonal(ctx: Ctx, x: number, y: number, fonts: { font: import("pdf-lib").PDFFont }) {
  drawDiag(ctx, x, y, DIAG_W, SECTION_SUB_H)
  drawText(ctx, "Rcvd", {
    x: x + 2,
    y: y + 3,
    width: Math.max(10, DIAG_W * 0.55),
    font: fonts.font,
    size: 5.2,
    align: "left",
    maxLength: 8,
  })
  drawText(ctx, "Used", {
    x: x + DIAG_W * 0.3,
    y: y + 15,
    width: DIAG_W * 0.66,
    font: fonts.font,
    size: 5.2,
    align: "right",
    maxLength: 8,
  })
}

function drawCountDiagonalCell(
  ctx: Ctx,
  x: number,
  y: number,
  rowH: number,
  rcvd: string,
  used: string,
  fonts: { font: import("pdf-lib").PDFFont }
) {
  drawDiag(ctx, x, y, DIAG_W, rowH)
  drawText(ctx, rcvd, {
    x: x + 2,
    y: y + 4,
    width: Math.max(10, DIAG_W * 0.55),
    font: fonts.font,
    size: 7,
    align: "center",
    maxLength: 6,
  })
  drawText(ctx, used, {
    x: x + DIAG_W * 0.35,
    y: y + rowH - 11,
    width: DIAG_W * 0.6,
    font: fonts.font,
    size: 7,
    align: "center",
    maxLength: 6,
  })
}

async function drawInitialsSlot(params: {
  ctx: Ctx
  outDoc: PDFDocument
  renderCtx: RenderCtx
  audit: unknown
  fallbackText: string
  x: number
  y: number
  w: number
  h: number
  font: import("pdf-lib").PDFFont
}) {
  const { ctx, outDoc, renderCtx, audit, fallbackText, x, y, w, h, font } = params
  try {
    const asset = await renderCtx.signatureResolver.resolveAuditSig(audit)
    const image = await embedSignatureAsset(outDoc, asset)
    if (image) {
      drawImageBox(ctx, image, { x: x + 1, y: y + 1, width: Math.max(4, w - 2), height: Math.max(4, h - 2) })
      drawDebugBox(ctx, x + 1, y + 1, Math.max(4, w - 2), Math.max(4, h - 2))
      return
    }
  } catch {
    // fallback to text below
  }
  if (fallbackText?.trim()) {
    drawText(ctx, fallbackText, {
      x: x + 1,
      y: y + 1,
      width: w - 2,
      font,
      size: 5.7,
      align: "center",
      maxLength: 6,
    })
  }
}

async function drawCountSection(params: {
  ctx: Ctx
  outDoc: PDFDocument
  renderCtx: RenderCtx
  y: number
  entries: EntryOrBlank[]
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont }
}) {
  const { ctx, outDoc, renderCtx, y, entries, fonts } = params
  const { font, fontBold } = fonts
  const x = TABLE_X
  const w = FORM_W

  rect(ctx, x, y, w, SECTION_H, 0.75)

  const yDate = y
  const ySub = yDate + SECTION_DATE_H
  const yDrug1 = ySub + SECTION_SUB_H
  const yDrug2 = yDrug1 + SECTION_DRUG_H
  const yDrug3 = yDrug2 + SECTION_DRUG_H
  const yInitials = yDrug3 + SECTION_DRUG_H
  const yEnd = y + SECTION_H

  // Shading to approximate paper form.
  fillRect(ctx, x + 1, yDate + 1, LABEL_W - 2, SECTION_DATE_H - 2, 0.93)
  fillRect(ctx, x + 1, yInitials + 1, LABEL_W - 2, SECTION_INITIALS_H - 2, 0.93)

  hLine(ctx, x, x + w, ySub, 0.5)
  hLine(ctx, x, x + w, yDrug1, 0.5)
  hLine(ctx, x, x + w, yDrug2, 0.45)
  hLine(ctx, x, x + w, yDrug3, 0.45)
  hLine(ctx, x, x + w, yInitials, 0.5)
  hLine(ctx, x, x + w, yEnd, 0.55)

  vLine(ctx, x + LABEL_W, y, yEnd, 0.55)

  for (let i = 1; i < DATE_COLUMNS_PER_SECTION; i++) {
    vLine(ctx, x + LABEL_W + DATE_GROUP_W * i, y, yEnd, 0.45)
  }

  for (let i = 0; i < DATE_COLUMNS_PER_SECTION; i++) {
    const gx = x + LABEL_W + DATE_GROUP_W * i
    const xAm = gx
    const xDiag = gx + AM_W
    const xPm = xDiag + DIAG_W
    // Keep AM / Rcvd-Used / PM splits above the initials row only.
    vLine(ctx, xDiag, ySub, yInitials, 0.4)
    vLine(ctx, xPm, ySub, yInitials, 0.4)

    // PM cell shading for the 3 drug rows to match the paper style
    fillRect(ctx, xPm + 0.5, yDrug1 + 0.5, PM_W - 1, SECTION_DRUG_H - 1, 0.9)
    fillRect(ctx, xPm + 0.5, yDrug2 + 0.5, PM_W - 1, SECTION_DRUG_H - 1, 0.9)
    fillRect(ctx, xPm + 0.5, yDrug3 + 0.5, PM_W - 1, SECTION_DRUG_H - 1, 0.9)

    const entry = entries[i]
    drawText(ctx, formatColumnDate(entry?.date ?? ""), {
      x: gx + 2,
      y: yDate + 6,
      width: DATE_GROUP_W - 4,
      font,
      size: 7,
      align: "center",
      maxLength: 14,
    })
    drawText(ctx, "AM", { x: xAm + 1, y: ySub + 6, width: AM_W - 2, font, size: 6.2, align: "center" })
    drawSubheaderDiagonal(ctx, xDiag, ySub, { font })
    drawText(ctx, "PM", { x: xPm + 1, y: ySub + 6, width: PM_W - 2, font, size: 6.2, align: "center" })

    const rows = [
      entry?.fentanyl ?? { am: "", rcvd: "", used: "", pm: "" },
      entry?.midazolam ?? { am: "", rcvd: "", used: "", pm: "" },
      entry?.ephedrine ?? { am: "", rcvd: "", used: "", pm: "" },
    ]
    const rowYs = [yDrug1, yDrug2, yDrug3]

    for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
      const row = rows[rowIdx]
      const ry = rowYs[rowIdx]
      drawText(ctx, row.am, { x: xAm + 1, y: ry + 8, width: AM_W - 2, font, size: 8.5, align: "center", maxLength: 6 })
      drawCountDiagonalCell(ctx, xDiag, ry, SECTION_DRUG_H, row.rcvd, row.used, { font })
      drawText(ctx, row.pm, { x: xPm + 1, y: ry + 8, width: PM_W - 2, font, size: 8.5, align: "center", maxLength: 6 })
    }

    // Initials row: two cells only (AM and PM), with the middle column removed.
    const audits = entry?.initials_audits ?? { am_1: null, am_2: null, pm_1: null, pm_2: null }
    const halfW = DATE_GROUP_W / 2
    const amCellX = gx
    const pmCellX = gx + halfW
    vLine(ctx, pmCellX, yInitials, yEnd, 0.35)
    drawDiag(ctx, amCellX, yInitials, halfW, SECTION_INITIALS_H, 0.35)
    drawDiag(ctx, pmCellX, yInitials, halfW, SECTION_INITIALS_H, 0.35)

    const amTopBox = { x: amCellX + 1, y: yInitials + 1, w: halfW * 0.58 - 2, h: SECTION_INITIALS_H * 0.48 - 2 }
    const amBotBox = {
      x: amCellX + halfW * 0.44,
      y: yInitials + SECTION_INITIALS_H * 0.52,
      w: halfW * 0.54 - 2,
      h: SECTION_INITIALS_H * 0.44 - 2,
    }
    const pmTopBox = { x: pmCellX + 1, y: yInitials + 1, w: halfW * 0.58 - 2, h: SECTION_INITIALS_H * 0.48 - 2 }
    const pmBotBox = {
      x: pmCellX + halfW * 0.44,
      y: yInitials + SECTION_INITIALS_H * 0.52,
      w: halfW * 0.54 - 2,
      h: SECTION_INITIALS_H * 0.44 - 2,
    }

    await drawInitialsSlot({
      ctx, outDoc, renderCtx,
      audit: audits.am_1,
      fallbackText: entry?.initials_am ?? "",
      x: amTopBox.x, y: amTopBox.y, w: amTopBox.w, h: amTopBox.h,
      font,
    })
    await drawInitialsSlot({
      ctx, outDoc, renderCtx,
      audit: audits.am_2,
      fallbackText: entry?.initials_am_2 ?? "",
      x: amBotBox.x, y: amBotBox.y, w: amBotBox.w, h: amBotBox.h,
      font,
    })
    await drawInitialsSlot({
      ctx, outDoc, renderCtx,
      audit: audits.pm_1,
      fallbackText: entry?.initials_pm ?? "",
      x: pmTopBox.x, y: pmTopBox.y, w: pmTopBox.w, h: pmTopBox.h,
      font,
    })
    await drawInitialsSlot({
      ctx, outDoc, renderCtx,
      audit: audits.pm_2,
      fallbackText: entry?.initials_pm_2 ?? "",
      x: pmBotBox.x, y: pmBotBox.y, w: pmBotBox.w, h: pmBotBox.h,
      font,
    })
  }

  drawText(ctx, "Date", {
    x: x + 8,
    y: yDate + 6,
    width: LABEL_W - 16,
    font: fontBold,
    size: 8.3,
    maxLength: 12,
  })

  const rowLabelYs = [yDrug1, yDrug2, yDrug3]
  NARCOTIC_COUNT_DRUGS.forEach((drug, idx) => {
    const ry = rowLabelYs[idx]
    drawText(ctx, drug.label, {
      x: x + 8,
      y: ry + 6,
      width: LABEL_W - 16,
      font,
      size: 6.9,
      maxLength: 36,
    })
    if ("detail" in drug && drug.detail) {
      drawText(ctx, drug.detail, {
        x: x + 8,
        y: ry + 16,
        width: LABEL_W - 16,
        font,
        size: 6.5,
        maxLength: 28,
      })
    }
  })

  drawText(ctx, "Initials", {
    x: x + 8,
    y: yInitials + 7,
    width: LABEL_W - 16,
    font: fontBold,
    size: 8.1,
    maxLength: 14,
  })
}

async function drawSignatureIdentification(params: {
  ctx: Ctx
  outDoc: PDFDocument
  renderCtx: RenderCtx
  data: DailyNarcoticCountLogData
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont }
}) {
  const { ctx, outDoc, renderCtx, data, fonts } = params
  const { font, fontBold } = fonts

  drawText(ctx, "SIGNATURE IDENTIFICATION", {
    x: FORM_X,
    y: SIG_TITLE_Y,
    width: 220,
    font: fontBold,
    size: 8.8,
    maxLength: 32,
  })

  const x = FORM_X
  const y = SIG_TABLE_Y
  const w = FORM_W
  const h = SIG_TABLE_H
  rect(ctx, x, y, w, h, 0.7)

  const halfW = w / 2
  const groupCols = { name: 160, sig: 145, initials: halfW - 160 - 145 }

  hLine(ctx, x, x + w, y + SIG_HEADER_H, 0.5)
  for (let i = 1; i <= 4; i++) hLine(ctx, x, x + w, y + SIG_HEADER_H + i * SIG_ROW_H, 0.4)

  vLine(ctx, x + halfW, y, y + h, 0.5)

  const leftGroupX = x
  const rightGroupX = x + halfW
  for (const gx of [leftGroupX, rightGroupX]) {
    vLine(ctx, gx + groupCols.name, y, y + h, 0.4)
    vLine(ctx, gx + groupCols.name + groupCols.sig, y, y + h, 0.4)
  }

  for (const [gx, slotOffset] of [[leftGroupX, 0], [rightGroupX, 4]] as const) {
    drawText(ctx, "Name", {
      x: gx + 2,
      y: y + 5,
      width: groupCols.name - 4,
      font: fontBold,
      size: 7,
      align: "center",
    })
    drawText(ctx, "Signature", {
      x: gx + groupCols.name + 2,
      y: y + 5,
      width: groupCols.sig - 4,
      font: fontBold,
      size: 7,
      align: "center",
    })
    drawText(ctx, "Initials", {
      x: gx + groupCols.name + groupCols.sig + 2,
      y: y + 5,
      width: groupCols.initials - 4,
      font: fontBold,
      size: 7,
      align: "center",
    })

    for (let row = 0; row < 4; row++) {
      const item = (data.signatures ?? [])[slotOffset + row] as CountSig | undefined
      const rowY = y + SIG_HEADER_H + row * SIG_ROW_H
      drawText(ctx, item?.name ?? "", {
        x: gx + 4,
        y: rowY + 5,
        width: groupCols.name - 8,
        font,
        size: 6.6,
        maxLength: 32,
      })
      drawText(ctx, item?.initials ?? "", {
        x: gx + groupCols.name + groupCols.sig + 2,
        y: rowY + 5,
        width: groupCols.initials - 4,
        font,
        size: 6.6,
        align: "center",
        maxLength: 8,
      })
      await drawSignatureInBox({
        outDoc,
        renderCtx,
        signatureValue: item?.signature,
        pageCtx: ctx,
        x: gx + groupCols.name + 3,
        y: rowY + 2,
        width: groupCols.sig - 6,
        height: SIG_ROW_H - 4,
      })
    }
  }
}

function drawFooterText(ctx: Ctx, font: import("pdf-lib").PDFFont) {
  drawText(ctx, "January 2025", {
    x: FORM_X,
    y: PAGE_H - 24,
    width: 80,
    font,
    size: 6.4,
    maxLength: 20,
  })
}

export const narcoticCountRenderer: RecordRenderer<RenderJob<DailyNarcoticCountLogData>> = {
  async render(job, renderCtx): Promise<RenderedPdfPart> {
    const out = await PDFDocument.create()
    const [font, fontBold] = await Promise.all([
      out.embedFont(StandardFonts.Helvetica),
      out.embedFont(StandardFonts.HelveticaBold),
    ])

    const allEntries = (job.data.entries ?? []).slice()
    const pages = Math.max(1, Math.ceil(allEntries.length / DATE_COLUMNS_PER_PAGE))
    const entryPages = pages === 1 && allEntries.length === 0
      ? [[]]
      : chunkEntries(allEntries, DATE_COLUMNS_PER_PAGE)

    while (entryPages.length < pages) entryPages.push([])

    for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
      const page = out.addPage([PAGE_W, PAGE_H])
      const ctx = createDrawContext(page, { debug: renderCtx.debug })
      drawHeader(ctx, job.data, job.entry.log_key ?? null, { font, fontBold }, pageIndex, pages)

      const pageEntries = entryPages[pageIndex] ?? []
      const sections = [
        padSectionEntries(pageEntries.slice(0, DATE_COLUMNS_PER_SECTION)),
        padSectionEntries(pageEntries.slice(DATE_COLUMNS_PER_SECTION, DATE_COLUMNS_PER_SECTION * 2)),
      ]

      await drawCountSection({
        ctx,
        outDoc: out,
        renderCtx,
        y: TABLE_Y,
        entries: sections[0],
        fonts: { font, fontBold },
      })
      await drawCountSection({
        ctx,
        outDoc: out,
        renderCtx,
        y: TABLE_Y + SECTION_H + SECTION_GAP,
        entries: sections[1],
        fonts: { font, fontBold },
      })
      await drawSignatureIdentification({
        ctx,
        outDoc: out,
        renderCtx,
        data: job.data,
        fonts: { font, fontBold },
      })
      drawFooterText(ctx, font)
    }

    return {
      bytes: await out.save(),
      pageCount: pages,
      description: `Daily narcotic count ${job.entry.log_key}`,
    }
  },
}
