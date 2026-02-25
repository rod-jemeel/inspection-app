import "server-only"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { SIGNOUT_DRUGS, type NarcoticSignoutLogData } from "@/lib/validations/log-entry"
import type { RecordRenderer, RenderJob } from "@/lib/server/log-pdf"
import { createDrawContext, drawText } from "@/lib/server/log-pdf/draw"
import { drawSignatureInBox } from "@/lib/server/log-pdf/renderers/_shared"
import type { RenderedPdfPart } from "@/lib/validations/log-export"

const PAGE_W = 612 // Letter portrait
const PAGE_H = 792
const MARGIN = 26
const CASES_PER_PAGE = 5

type Ctx = ReturnType<typeof createDrawContext>

function py(ctx: Ctx, y: number) {
  return ctx.pageHeight - y
}

function hLine(ctx: Ctx, x1: number, x2: number, y: number, t = 0.6) {
  const yy = py(ctx, y)
  ctx.page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: t })
}

function vLine(ctx: Ctx, x: number, y1: number, y2: number, t = 0.6) {
  ctx.page.drawLine({ start: { x, y: py(ctx, y1) }, end: { x, y: py(ctx, y2) }, thickness: t })
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, t = 0.8) {
  hLine(ctx, x, x + w, y, t)
  hLine(ctx, x, x + w, y + h, t)
  vLine(ctx, x, y, y + h, t)
  vLine(ctx, x + w, y, y + h, t)
}

function formatFormDate(input: string) {
  if (!input) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-")
    return `${m}/${d}/${y.slice(-2)}`
  }
  return input
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  for (const v of values) {
    const trimmed = (v ?? "").trim()
    if (trimmed) return trimmed
  }
  return ""
}

function splitDrugHeader(
  key: string,
  customName: string | undefined
): [string, string, string] {
  switch (key) {
    case "fentanyl_250":
      return ["Fentanyl", "250 mcg", "(5 ml)"]
    case "fentanyl_100":
      return ["Fentanyl", "100 mcg", "(2 ml)"]
    case "midazolam_5":
      return ["Midazolam", "5 mg", "(5 ml)"]
    case "midazolam_2":
      return ["Midazolam", "2 mg", "(2 ml)"]
    case "custom": {
      const raw = (customName ?? "").trim()
      if (!raw) return ["Custom", "", ""]
      const parts = raw.split(/\s+/)
      if (parts.length === 1) return [parts[0], "", ""]
      if (parts.length === 2) return [parts[0], parts[1], ""]
      return [parts.slice(0, 2).join(" "), parts.slice(2, 4).join(" "), parts.slice(4).join(" ")]
    }
    default:
      return [key, "", ""]
  }
}

function drawWrappedPatientName(
  ctx: Ctx,
  name: string,
  x: number,
  y: number,
  w: number,
  font: import("pdf-lib").PDFFont
) {
  const text = (name ?? "").trim()
  if (!text) return
  const parts = text.split(/\s+/)
  if (parts.length <= 2) {
    drawText(ctx, text, { x, y, width: w, font, size: 9, align: "center", maxLength: 28 })
    return
  }
  const mid = Math.ceil(parts.length / 2)
  drawText(ctx, parts.slice(0, mid).join(" "), { x, y: y - 8, width: w, font, size: 8.6, align: "center", maxLength: 26 })
  drawText(ctx, parts.slice(mid).join(" "), { x, y: y + 5, width: w, font, size: 8.6, align: "center", maxLength: 26 })
}

function drawPageHeader(
  ctx: Ctx,
  d: NarcoticSignoutLogData,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont },
  pageIndex: number,
  pageCount: number
) {
  const { font, fontBold } = fonts
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2

  drawText(ctx, "South Loop Endoscopy & Wellness Center", {
    x,
    y: 26,
    width: 250,
    font: fontBold,
    size: 9.6,
    maxLength: 48,
  })
  drawText(ctx, "Anesthesiologist/CRNA Narcotic Sign-Out Form", {
    x,
    y: 39,
    width: 255,
    font,
    size: 8.8,
    maxLength: 54,
  })

  const rightX = x + 255
  drawText(ctx, "Anesthesia MD:", { x: rightX, y: 27, width: 68, font, size: 8 })
  drawText(ctx, d.print_name || d.anesthesia_md, {
    x: rightX + 72,
    y: 27,
    width: x + w - (rightX + 78),
    font,
    size: 8,
    maxLength: 26,
  })
  hLine(ctx, rightX + 72, x + w - 4, 36, 0.35)

  if (pageCount > 1) {
    drawText(ctx, `Page ${pageIndex + 1} of ${pageCount}`, {
      x,
      y: 55,
      width: w,
      font,
      size: 7.2,
      align: "right",
    })
  }
}

async function drawSignoutPage(params: {
  ctx: Ctx
  outDoc: PDFDocument
  renderCtx: Parameters<RecordRenderer["render"]>[1]
  data: NarcoticSignoutLogData
  logDate: string
  cases: NarcoticSignoutLogData["cases"]
  isLastPage: boolean
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont }
}) {
  const { ctx, outDoc, renderCtx, data, logDate, cases, isLastPage, fonts } = params
  const { font, fontBold } = fonts
  const x = MARGIN
  const y = 74
  const w = PAGE_W - MARGIN * 2

  const patientW = 196
  const subLabelW = 94
  const drugCols = SIGNOUT_DRUGS.length
  const drugW = (w - patientW - subLabelW) / drugCols // 54 on letter portrait with current widths
  const xPatientEnd = x + patientW
  const xDrugStart = x + patientW + subLabelW
  const xEnd = x + w

  const dateH = 44
  const anesthSigH = 24
  const nurseSigH = 24
  const qtyDispH = 28
  const caseAdminH = 24
  const caseWasteH = 22
  const caseCoSigH = 20
  const caseH = caseAdminH + caseWasteH + caseCoSigH
  const totalUsedH = 28
  const endBalH = 28
  const rnSigH = 28
  const noteH = 20
  const totalH = dateH + anesthSigH + nurseSigH + qtyDispH + CASES_PER_PAGE * caseH + totalUsedH + endBalH + rnSigH + noteH

  rect(ctx, x, y, w, totalH, 0.8)

  // Header/table title row boundaries
  const yDate = y
  const yAfterDate = yDate + dateH
  const yAfterAnSig = yAfterDate + anesthSigH
  const yAfterNurseSig = yAfterAnSig + nurseSigH
  const yAfterQty = yAfterNurseSig + qtyDispH

  // In the paper form, the 5 drug header columns span the top 3 rows
  // (Date + Anesthesiologist Signature + Nurse Signature). So the first two
  // horizontal lines stop at the left edge of the drug grid.
  hLine(ctx, x, xDrugStart, yAfterDate, 0.55)
  hLine(ctx, x, xDrugStart, yAfterAnSig, 0.5)
  hLine(ctx, x, xEnd, yAfterNurseSig, 0.5)
  hLine(ctx, x, xEnd, yAfterQty, 0.55)

  // Top rows: each drug column is a tall merged cell across the top 3 rows,
  // then the quantity row below is split again by drug.
  vLine(ctx, xDrugStart, yDate, yAfterQty, 0.6)
  for (let i = 1; i < drugCols; i++) {
    const vx = xDrugStart + i * drugW
    vLine(ctx, vx, yDate, yAfterQty, 0.45)
  }

  // Cases grid
  let cursorY = yAfterQty
  for (let caseIdx = 0; caseIdx < CASES_PER_PAGE; caseIdx++) {
    const blockTop = cursorY
    const blockBottom = blockTop + caseH
    const wasteLineY = blockTop + caseAdminH
    const coSigLineY = wasteLineY + caseWasteH

    hLine(ctx, x, xEnd, blockBottom, 0.5)
    hLine(ctx, xPatientEnd, xEnd, wasteLineY, 0.45)
    hLine(ctx, xPatientEnd, xEnd, coSigLineY, 0.45)

    vLine(ctx, xPatientEnd, blockTop, blockBottom, 0.5)
    vLine(ctx, xDrugStart, blockTop, blockBottom, 0.6)
    // Drug column splits only for Amount Administered / Wasted rows (not co-sign row)
    for (let i = 1; i < drugCols; i++) {
      const vx = xDrugStart + i * drugW
      vLine(ctx, vx, blockTop, coSigLineY, 0.4)
    }

    cursorY = blockBottom
  }

  const yAfterCases = cursorY
  const yAfterTotalUsed = yAfterCases + totalUsedH
  const yAfterEndBal = yAfterTotalUsed + endBalH
  const yAfterRnSig = yAfterEndBal + rnSigH
  const yAfterNote = yAfterRnSig + noteH

  hLine(ctx, x, xEnd, yAfterTotalUsed, 0.5)
  hLine(ctx, x, xEnd, yAfterEndBal, 0.5)
  hLine(ctx, x, xEnd, yAfterRnSig, 0.55)
  hLine(ctx, x, xEnd, yAfterNote, 0.55)

  // Totals rows: left area merged + drug columns split
  vLine(ctx, xDrugStart, yAfterCases, yAfterEndBal, 0.6)
  for (let i = 1; i < drugCols; i++) vLine(ctx, xDrugStart + i * drugW, yAfterCases, yAfterEndBal, 0.45)

  // RN row: left area label + merged right signature cell
  vLine(ctx, xDrugStart, yAfterEndBal, yAfterRnSig, 0.6)

  // Top row content
  drawText(ctx, "Date", { x: x + 6, y: yDate + 10, width: 34, font: fontBold, size: 8.8 })
  drawText(ctx, formatFormDate(logDate), {
    x: x + 44,
    y: yDate + 12,
    width: xDrugStart - x - 52,
    font,
    size: 10.8,
    maxLength: 14,
  })

  SIGNOUT_DRUGS.forEach((drug, idx) => {
    const colX = xDrugStart + idx * drugW
    const [l1, l2, l3] = splitDrugHeader(drug.key, data.custom_drug_name)
    drawText(ctx, l1, { x: colX + 3, y: yDate + 8, width: drugW - 6, font, size: 6.5, align: "center", maxLength: 16 })
    drawText(ctx, l2, { x: colX + 3, y: yDate + 18, width: drugW - 6, font, size: 6.3, align: "center", maxLength: 14 })
    drawText(ctx, l3, { x: colX + 3, y: yDate + 30, width: drugW - 6, font, size: 6.2, align: "center", maxLength: 14 })
  })

  // Signature / qty rows labels
  drawText(ctx, "Anesthesiologist Signature", {
    x: x + 6,
    y: yAfterDate + 8,
    width: xDrugStart - x - 12,
    font: fontBold,
    size: 7.5,
    maxLength: 34,
  })
  drawText(ctx, "Nurse Signature", {
    x: x + 6,
    y: yAfterAnSig + 8,
    width: xDrugStart - x - 12,
    font: fontBold,
    size: 7.5,
    maxLength: 24,
  })
  drawText(ctx, "Quantity Dispensed (# of units)", {
    x: x + 6,
    y: yAfterNurseSig + 9,
    width: xDrugStart - x - 12,
    font: fontBold,
    size: 7.8,
    maxLength: 36,
  })

  // Top signatures are shown once in the left-side signature lines to match the
  // paper form layout. Quantity dispensed remains per-drug in the right grid.
  const topAnesthSig = firstNonEmpty(SIGNOUT_DRUGS.map((d) => data.drug_headers?.[d.key]?.anesthesiologist_sig))
  const topNurseSig = firstNonEmpty(SIGNOUT_DRUGS.map((d) => data.drug_headers?.[d.key]?.nurse_sig))
  await drawSignatureInBox({
    outDoc,
    renderCtx,
    signatureValue: topAnesthSig,
    pageCtx: ctx,
    x: x + 152,
    y: yAfterDate + 2,
    width: Math.max(40, xDrugStart - (x + 156)),
    height: anesthSigH - 4,
  })
  await drawSignatureInBox({
    outDoc,
    renderCtx,
    signatureValue: topNurseSig,
    pageCtx: ctx,
    x: x + 102,
    y: yAfterAnSig + 2,
    width: Math.max(40, xDrugStart - (x + 106)),
    height: nurseSigH - 4,
  })
  // Ensure the left-label / drug-grid boundary remains crisp.
  vLine(ctx, xDrugStart, yDate, yAfterNurseSig, 0.7)

  // Drug header qty row values
  for (let idx = 0; idx < SIGNOUT_DRUGS.length; idx++) {
    const drugKey = SIGNOUT_DRUGS[idx].key
    const colX = xDrugStart + idx * drugW
    const header = data.drug_headers?.[drugKey]
    drawText(ctx, header?.qty_dispensed ?? "", {
      x: colX + 2,
      y: yAfterNurseSig + 8,
      width: drugW - 4,
      font,
      size: 8.6,
      align: "center",
      maxLength: 8,
    })
  }

  // Case blocks (draw 5 slots to preserve the paper layout)
  for (let i = 0; i < CASES_PER_PAGE; i++) {
    const caseData = cases[i]
    const blockTop = yAfterQty + i * caseH
    const adminY = blockTop
    const wasteY = blockTop + caseAdminH
    const coSigY = wasteY + caseWasteH

    drawText(ctx, "Patient Name", {
      x: x + 6,
      y: blockTop + 8,
      width: patientW - 12,
      font: fontBold,
      size: 7.2,
      maxLength: 18,
    })
    drawText(ctx, `Case ${i + 1}`, {
      x: x + 6,
      y: blockTop + 21,
      width: 40,
      font: fontBold,
      size: 7,
    })
    if (caseData) {
      drawWrappedPatientName(ctx, caseData.patient_name, x + 38, blockTop + 24, patientW - 46, font)
    }

    drawText(ctx, "Amount", { x: xPatientEnd + 3, y: adminY + 6, width: subLabelW - 6, font, size: 7, align: "center" })
    drawText(ctx, "Administered", { x: xPatientEnd + 3, y: adminY + 15, width: subLabelW - 6, font, size: 6.8, align: "center" })
    drawText(ctx, "Amount Wasted", { x: xPatientEnd + 3, y: wasteY + 9, width: subLabelW - 6, font, size: 7.1, align: "center" })
    drawText(ctx, "Co-Signature", { x: xPatientEnd + 3, y: coSigY + 7, width: subLabelW - 6, font, size: 7.1, align: "center" })

    for (let colIdx = 0; colIdx < SIGNOUT_DRUGS.length; colIdx++) {
      const drugKey = SIGNOUT_DRUGS[colIdx].key
      const colX = xDrugStart + colIdx * drugW
      const amt = caseData?.amounts?.[drugKey]
      drawText(ctx, amt?.administered ?? "", {
        x: colX + 2,
        y: adminY + 8,
        width: drugW - 4,
        font,
        size: 8,
        align: "center",
        maxLength: 8,
      })
      drawText(ctx, amt?.wasted ?? "", {
        x: colX + 2,
        y: wasteY + 7,
        width: drugW - 4,
        font,
        size: 8,
        align: "center",
        maxLength: 8,
      })
    }

    if (caseData?.co_signature) {
      await drawSignatureInBox({
        outDoc,
        renderCtx,
        signatureValue: caseData.co_signature,
        pageCtx: ctx,
        x: xDrugStart + 4,
        y: coSigY + 2,
        width: xEnd - xDrugStart - 8,
        height: caseCoSigH - 4,
      })
    }
  }

  drawText(ctx, "Total Quantity Used (# units)", {
    x: x + 6,
    y: yAfterCases + 9,
    width: xDrugStart - x - 12,
    font: fontBold,
    size: 7.6,
    maxLength: 34,
  })
  drawText(ctx, "End Balance Returned (# of units)", {
    x: x + 6,
    y: yAfterTotalUsed + 9,
    width: xDrugStart - x - 12,
    font: fontBold,
    size: 7.4,
    maxLength: 36,
  })
  drawText(ctx, "RN Signature", {
    x: x + 6,
    y: yAfterEndBal + 9,
    width: xDrugStart - x - 12,
    font: fontBold,
    size: 7.6,
    maxLength: 18,
  })

  if (isLastPage) {
    for (let colIdx = 0; colIdx < SIGNOUT_DRUGS.length; colIdx++) {
      const drugKey = SIGNOUT_DRUGS[colIdx].key
      const colX = xDrugStart + colIdx * drugW
      drawText(ctx, data.total_qty_used?.[drugKey] ?? "", {
        x: colX + 2,
        y: yAfterCases + 8,
        width: drugW - 4,
        font,
        size: 8.4,
        align: "center",
        maxLength: 10,
      })
      drawText(ctx, data.end_balance?.[drugKey] ?? "", {
        x: colX + 2,
        y: yAfterTotalUsed + 8,
        width: drugW - 4,
        font,
        size: 8.4,
        align: "center",
        maxLength: 10,
      })
    }

    await drawSignatureInBox({
      outDoc,
      renderCtx,
      signatureValue: data.rn_signature,
      pageCtx: ctx,
      x: xDrugStart + 4,
      y: yAfterEndBal + 2,
      width: xEnd - xDrugStart - 8,
      height: rnSigH - 4,
    })
  }

  drawText(ctx, "Co-Signature Required For All Wasted Doses", {
    x,
    y: yAfterRnSig + 6,
    width: w,
    font: fontBold,
    size: 7.4,
    align: "center",
    maxLength: 52,
  })

  // Add a subtle line above the footer note to visually match the paper form.
  hLine(ctx, x, xEnd, yAfterRnSig, 0.6)

  // Preserve paper footer spacing and ensure the note row remains blank otherwise.
  const fallbackTopName = firstNonEmpty([data.print_name, data.anesthesia_md])
  if (!topAnesthSig && fallbackTopName) {
    drawText(ctx, fallbackTopName, {
      x: x + 140,
      y: yAfterDate + 8,
      width: xDrugStart - x - 148,
      font,
      size: 8.4,
      maxLength: 26,
    })
  }
  if (!topNurseSig && fallbackTopName) {
    drawText(ctx, fallbackTopName, {
      x: x + 120,
      y: yAfterAnSig + 8,
      width: xDrugStart - x - 128,
      font,
      size: 8.4,
      maxLength: 26,
    })
  }
}

export const narcoticSignoutRenderer: RecordRenderer<RenderJob<NarcoticSignoutLogData>> = {
  async render(job, renderCtx): Promise<RenderedPdfPart> {
    const out = await PDFDocument.create()
    const [font, fontBold] = await Promise.all([
      out.embedFont(StandardFonts.Helvetica),
      out.embedFont(StandardFonts.HelveticaBold),
    ])

    const allCases = job.data.cases ?? []
    const pageCount = Math.max(1, Math.ceil(allCases.length / CASES_PER_PAGE))

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page = out.addPage([PAGE_W, PAGE_H])
      const ctx = createDrawContext(page, { debug: renderCtx.debug })
      drawPageHeader(ctx, job.data, { font, fontBold }, pageIndex, pageCount)

      const slice = allCases.slice(pageIndex * CASES_PER_PAGE, (pageIndex + 1) * CASES_PER_PAGE)
      await drawSignoutPage({
        ctx,
        outDoc: out,
        renderCtx,
        data: job.data,
        logDate: job.entry.log_date,
        cases: slice,
        isLastPage: pageIndex === pageCount - 1,
        fonts: { font, fontBold },
      })
    }

    return {
      bytes: await out.save(),
      pageCount,
      description: `Narcotic sign-out ${job.entry.log_date}`,
    }
  },
}
