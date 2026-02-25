import "server-only"
import { PDFDocument, StandardFonts } from "pdf-lib"
import type { CardiacArrestRecordData } from "@/lib/validations/log-entry"
import type { RecordRenderer, RenderJob } from "@/lib/server/log-pdf"
import { createDrawContext, drawText } from "@/lib/server/log-pdf/draw"
import { drawSignatureInBox } from "@/lib/server/log-pdf/renderers/_shared"
import type { RenderedPdfPart } from "@/lib/validations/log-export"

const PAGE_W = 792 // Letter landscape
const PAGE_H = 612
const MARGIN = 8

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

function checkMark(ctx: Ctx, x: number, y: number, w: number, h: number, thickness = 0.9) {
  const p1 = { x: x + w * 0.18, y: py(ctx, y + h * 0.55) }
  const p2 = { x: x + w * 0.4, y: py(ctx, y + h * 0.78) }
  const p3 = { x: x + w * 0.82, y: py(ctx, y + h * 0.24) }
  ctx.page.drawLine({ start: p1, end: p2, thickness })
  ctx.page.drawLine({ start: p2, end: p3, thickness })
}

function drawCheckboxField(
  ctx: Ctx,
  checked: boolean,
  x: number,
  y: number,
  label: string,
  font: import("pdf-lib").PDFFont,
  opts?: { box?: number; labelWidth?: number }
) {
  const box = opts?.box ?? 7
  rect(ctx, x, y, box, box, 0.5)
  if (checked) checkMark(ctx, x + 0.6, y + 0.4, box - 1.2, box - 0.8, 0.8)
  drawText(ctx, label, {
    x: x + box + 3,
    y: y + 0.5,
    width: opts?.labelWidth ?? 80,
    font,
    size: 6.2,
    maxLength: 24,
  })
}

function drawMultiline(
  ctx: Ctx,
  lines: string[],
  x: number,
  y: number,
  width: number,
  font: import("pdf-lib").PDFFont,
  size: number,
  lineGap = 7
) {
  lines.forEach((line, i) => {
    drawText(ctx, line, { x, y: y + i * lineGap, width, font, size, align: "center", maxLength: 80 })
  })
}

const TABLE_COLS = [
  { key: "time", label: ["Time"], w: 36, align: "center" },
  { key: "cardiac_rhythm", label: ["Cardiac", "Rhythm"], w: 46, align: "center" },
  { key: "pulse", label: ["Pulse"], w: 34, align: "center" },
  { key: "respirations", label: ["Respirations", "A-assisted", "S-spont"], w: 46, align: "center" },
  { key: "blood_pressure", label: ["Blood", "Pressure"], w: 44, align: "center" },
  { key: "epinephrine", label: ["Epinephrine", "(dose/route)"], w: 54, align: "center" },
  { key: "atropine", label: ["Atropine", "dose/route"], w: 52, align: "center" },
  { key: "lidocaine_drug", label: ["Lidocaine", "dose/route"], w: 54, align: "center" },
  { key: "other_drug", label: ["Other"], w: 44, align: "center" },
  { key: "joules", label: ["Joules"], w: 40, align: "center" },
  { key: "rhythm_pre", label: ["Pre"], w: 34, align: "center" },
  { key: "rhythm_post", label: ["Post"], w: 34, align: "center" },
  { key: "lidocaine_iv", label: ["Lidocaine", "2gms/", "500cc"], w: 46, align: "center" },
  { key: "dopamine", label: ["Dopamine", "400mg/", "500cc"], w: 48, align: "center" },
  { key: "dobutamine", label: ["Dobut.", "250mg/", "250cc"], w: 50, align: "center" },
  { key: "other_iv", label: ["Other"], w: 36, align: "center" },
  { key: "comments", label: ["Comments"], w: 74, align: "left" },
] as const

type RowKey = typeof TABLE_COLS[number]["key"]

function colXPositions(startX: number) {
  const xs = [startX]
  for (const c of TABLE_COLS) xs.push(xs[xs.length - 1] + c.w)
  return xs
}

function drawTopSection(
  ctx: Ctx,
  d: CardiacArrestRecordData,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont }
) {
  const { font, fontBold } = fonts
  const x = MARGIN
  const y = 42
  const w = PAGE_W - MARGIN * 2
  const leftW = 468
  const rightW = w - leftW
  const titleBoxH = 96
  const cprRowH = 24
  const totalH = titleBoxH + cprRowH

  rect(ctx, x, y, w, totalH, 0.8)
  vLine(ctx, x + leftW, y, y + titleBoxH, 0.7)
  hLine(ctx, x, x + w, y + titleBoxH, 0.7)

  // Left top block rows
  const r1 = 24
  const r2 = 24
  const r3 = 26
  const r4 = 22
  hLine(ctx, x, x + leftW, y + r1, 0.5)
  hLine(ctx, x, x + leftW, y + r1 + r2, 0.5)
  hLine(ctx, x, x + leftW, y + r1 + r2 + r3, 0.5)

  // Row 4 vertical splits
  const row4Y = y + r1 + r2 + r3
  const c1 = x + 158
  const c2 = x + 326
  const c3 = x + 390
  vLine(ctx, c1, row4Y, row4Y + r4, 0.5)
  vLine(ctx, c2, row4Y, row4Y + r4, 0.5)
  vLine(ctx, c3, row4Y, row4Y + r4, 0.5)

  // Row 3 split: last observation + initial signs
  const row3Y = y + r1 + r2
  const row3Split = x + 170
  vLine(ctx, row3Split, row3Y, row3Y + r3, 0.5)

  drawText(ctx, "Admission diagnosis", { x: x + 6, y: y + 8, width: 140, font, size: 7.2 })
  drawText(ctx, d.admission_diagnosis, { x: x + 120, y: y + 8, width: leftW - 126, font, size: 7.1, maxLength: 70 })

  drawText(ctx, "History of events prior to arrest:", { x: x + 6, y: y + r1 + 8, width: 180, font, size: 7.2 })
  drawText(ctx, d.history_prior, { x: x + 186, y: y + r1 + 8, width: leftW - 192, font, size: 7.1, maxLength: 84 })

  drawText(ctx, "Last", { x: x + 6, y: row3Y + 7, width: 24, font, size: 6.8 })
  drawText(ctx, "observation", { x: x + 31, y: row3Y + 7, width: 54, font, size: 6.8 })
  drawText(ctx, "time:", { x: x + 6, y: row3Y + 15, width: 24, font, size: 6.8 })
  drawText(ctx, d.last_observation_time, { x: x + 88, y: row3Y + 11, width: row3Split - x - 94, font, size: 6.8, maxLength: 18 })

  drawText(ctx, "Initial signs of arrest:", { x: row3Split + 6, y: row3Y + 7, width: 82, font, size: 6.8 })
  drawCheckboxField(ctx, !!d.initial_signs?.cyanosis, row3Split + 92, row3Y + 11, "Cyanosis", font, { labelWidth: 42, box: 6 })
  drawCheckboxField(ctx, !!d.initial_signs?.apnea, row3Split + 148, row3Y + 11, "Apnea", font, { labelWidth: 26, box: 6 })
  drawCheckboxField(ctx, !!d.initial_signs?.absence_of_pulse, row3Split + 190, row3Y + 11, "Absence of Pulse", font, { labelWidth: 62, box: 6 })
  drawCheckboxField(ctx, !!d.initial_signs?.other, row3Split + 266, row3Y + 11, "Other:", font, { labelWidth: 24, box: 6 })
  drawText(ctx, d.initial_signs?.other ?? "", { x: row3Split + 300, y: row3Y + 11, width: leftW - (row3Split - x) - 306, font, size: 6.7, maxLength: 18 })

  drawText(ctx, "Initial heart rhythm:", { x: x + 6, y: row4Y + 7, width: 84, font, size: 6.8 })
  drawText(ctx, d.initial_heart_rhythm, { x: x + 92, y: row4Y + 7, width: c1 - x - 98, font, size: 6.8, maxLength: 18 })
  drawText(ctx, "Site of arrest:", { x: c1 + 6, y: row4Y + 7, width: 54, font, size: 6.8 })
  drawText(ctx, d.site_of_arrest, { x: c1 + 62, y: row4Y + 7, width: c2 - c1 - 68, font, size: 6.8, maxLength: 16 })
  drawText(ctx, "Date:", { x: c2 + 5, y: row4Y + 7, width: 22, font, size: 6.8 })
  drawText(ctx, d.arrest_date, { x: c2 + 27, y: row4Y + 7, width: c3 - c2 - 30, font, size: 6.7, maxLength: 10 })
  drawText(ctx, "Time:", { x: c3 + 5, y: row4Y + 7, width: 22, font, size: 6.8 })
  drawText(ctx, d.arrest_time, { x: c3 + 27, y: row4Y + 7, width: leftW - (c3 - x) - 30, font, size: 6.7, maxLength: 10 })

  // Right title box
  drawMultiline(ctx, ["CARDIAC ARREST", "RECORD"], x + leftW + 20, y + 16, rightW - 40, fontBold, 10.8, 14)
  drawText(ctx, "Page", { x: x + leftW + 106, y: y + 72, width: 22, font, size: 7.1 })
  hLine(ctx, x + leftW + 127, x + leftW + 152, y + 83, 0.4)
  drawText(ctx, d.page_number, { x: x + leftW + 128, y: y + 74, width: 23, font, size: 7, align: "center", maxLength: 4 })
  drawText(ctx, "of", { x: x + leftW + 155, y: y + 72, width: 10, font, size: 7.1, align: "center" })
  hLine(ctx, x + leftW + 167, x + leftW + 191, y + 83, 0.4)
  drawText(ctx, d.page_total, { x: x + leftW + 168, y: y + 74, width: 22, font, size: 7, align: "center", maxLength: 4 })

  // CPR / Ventilation / Intubation row (full width)
  const cprY = y + titleBoxH
  const s1 = x + 112
  const s2 = x + 360
  const s3 = x + 532
  const s4 = x + 610
  vLine(ctx, s1, cprY, cprY + cprRowH, 0.5)
  vLine(ctx, s2, cprY, cprY + cprRowH, 0.5)
  vLine(ctx, s3, cprY, cprY + cprRowH, 0.5)
  vLine(ctx, s4, cprY, cprY + cprRowH, 0.5)

  drawText(ctx, "Time CPR begun:", { x: x + 6, y: cprY + 7, width: 74, font, size: 6.8 })
  drawText(ctx, d.time_cpr_begun, { x: x + 78, y: cprY + 7, width: s1 - x - 84, font, size: 6.7, maxLength: 12 })

  drawText(ctx, "Ventilation:", { x: s1 + 6, y: cprY + 7, width: 44, font, size: 6.4 })
  drawCheckboxField(ctx, !!d.ventilation?.mouth_mask, s1 + 50, cprY + 10, "Mouth / mask", font, { labelWidth: 50, box: 5 })
  drawCheckboxField(ctx, !!d.ventilation?.bag_mask, s1 + 118, cprY + 10, "Bag / mask", font, { labelWidth: 40, box: 5 })
  drawCheckboxField(ctx, !!d.ventilation?.bag_tube, s1 + 175, cprY + 10, "Bag / tube", font, { labelWidth: 34, box: 5 })

  drawText(ctx, "Intubated by:", { x: s2 + 5, y: cprY + 7, width: 54, font, size: 6.4 })
  drawText(ctx, d.intubated_by, { x: s2 + 58, y: cprY + 7, width: s3 - s2 - 63, font, size: 6.4, maxLength: 20 })

  drawText(ctx, "ETT Size:", { x: s3 + 5, y: cprY + 7, width: 38, font, size: 6.4 })
  drawText(ctx, d.ett_size, { x: s3 + 43, y: cprY + 7, width: s4 - s3 - 47, font, size: 6.4, align: "center", maxLength: 6 })

  drawText(ctx, "Time:", { x: s4 + 5, y: cprY + 7, width: 20, font, size: 6.4 })
  drawText(ctx, d.intubation_time, { x: s4 + 24, y: cprY + 7, width: x + w - s4 - 28, font, size: 6.4, maxLength: 10 })
}

function drawMainTable(
  ctx: Ctx,
  d: CardiacArrestRecordData,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont }
) {
  const { font, fontBold } = fonts
  const x = MARGIN
  const y = 162
  const w = TABLE_COLS.reduce((sum, c) => sum + c.w, 0)
  const groupH = 14
  const headH = 24
  const subH = 14
  const rowH = 24
  const rows = 12
  const totalH = groupH + headH + subH + rowH * rows
  const xs = colXPositions(x)
  const headerBottomY = y + groupH + headH + subH

  rect(ctx, x, y, w, totalH, 0.8)

  // Main horizontal lines
  hLine(ctx, x, x + w, y + groupH, 0.6)
  hLine(ctx, x, x + w, headerBottomY, 0.6)
  for (let r = 1; r < rows; r++) hLine(ctx, x, x + w, headerBottomY + r * rowH, 0.4)

  // Group boundaries in top header row
  const groupBoundaries = [
    xs[0],
    xs[1], // time
    xs[5], // vital signs end
    xs[9], // drugs end
    xs[12], // defib end
    xs[16], // iv end
    xs[17], // comments end
  ]
  for (let i = 0; i < groupBoundaries.length; i++) {
    if (i === 0 || i === groupBoundaries.length - 1) continue
    vLine(ctx, groupBoundaries[i], y, y + totalH, 0.6)
  }

  // Column verticals below group row. Keep the Pre/Post divider out of the
  // Defibrillation header row so "Rhythm" is a true merged header cell.
  for (let i = 1; i < xs.length - 1; i++) {
    if (i === 11) {
      vLine(ctx, xs[i], y + groupH + headH, y + totalH, 0.45)
      continue
    }
    vLine(ctx, xs[i], y + groupH, y + totalH, 0.45)
  }

  // Pre/Post split only below "Rhythm" header row (Defibrillation > Rhythm)
  hLine(ctx, xs[10], xs[12], y + groupH + headH, 0.45)

  // Group labels
  const groups = [
    { label: "Time", start: 0, end: 1 },
    { label: "Vital Signs", start: 1, end: 5 },
    { label: "Drugs (amount & route)", start: 5, end: 9 },
    { label: "Defibrillation", start: 9, end: 12 },
    { label: "IV Solutions (dose)", start: 12, end: 16 },
    { label: "Comments", start: 16, end: 17 },
  ]
  groups.forEach((g) => {
    drawText(ctx, g.label, {
      x: xs[g.start] + 2,
      y: y + 4,
      width: xs[g.end] - xs[g.start] - 4,
      font: fontBold,
      size: 6.8,
      align: "center",
      maxLength: 36,
    })
  })

  // Column labels
  TABLE_COLS.forEach((col, idx) => {
    const cx = xs[idx]
    const cw = col.w
    if (col.key === "rhythm_pre" || col.key === "rhythm_post") return
    if (col.key === "time") {
      return
    }
    if (col.key === "joules") {
      drawText(ctx, "Joules", { x: cx + 2, y: y + groupH + 8, width: cw - 4, font, size: 6.6, align: "center" })
      return
    }
    if (col.key === "comments") {
      drawMultiline(
        ctx,
        ["(lab results [ABG's, K+]; procedures", "performed pacemaker, cardioversion", "pericardiocentesis [AP, etc.])"],
        cx + 2,
        y + groupH + 9.8,
        cw - 4,
        font,
        4.0,
        4.0
      )
      return
    }
    const labelLines = col.label
    const startY = y + groupH + 6.5
    labelLines.forEach((line, lineIdx) => {
      drawText(ctx, line, {
        x: cx + 1,
        y: startY + lineIdx * 5.5,
        width: cw - 2,
        font,
        size: 4.5,
        align: "center",
        maxLength: 18,
      })
    })
  })

  drawText(ctx, "Rhythm", {
    x: xs[10] + 2,
    y: y + groupH + 8,
    width: xs[12] - xs[10] - 4,
    font,
    size: 5.5,
    align: "center",
  })
  drawText(ctx, "Pre", {
    x: xs[10] + 1,
    y: y + groupH + headH + 4.0,
    width: xs[11] - xs[10] - 2,
    font,
    size: 5.1,
    align: "center",
  })
  drawText(ctx, "Post", {
    x: xs[11] + 1,
    y: y + groupH + headH + 4.0,
    width: xs[12] - xs[11] - 2,
    font,
    size: 5.1,
    align: "center",
  })

  // Data rows
  const rowKeys = TABLE_COLS.map((c) => c.key) as RowKey[]
  ;(d.rows ?? []).slice(0, rows).forEach((row, rowIdx) => {
    const rowY = headerBottomY + rowIdx * rowH
    rowKeys.forEach((key, colIdx) => {
      const col = TABLE_COLS[colIdx]
      const value = row[key] ?? ""
    drawText(ctx, value, {
        x: xs[colIdx] + 2,
        y: rowY + 7,
        width: col.w - 4,
        font,
        size: key === "comments" ? 5.1 : 5.6,
        align: key === "comments" ? "left" : "center",
        maxLength: key === "comments" ? 24 : 14,
      })
    })
  })
}

async function drawFooter(
  ctx: Ctx,
  d: CardiacArrestRecordData,
  fonts: { font: import("pdf-lib").PDFFont; fontBold: import("pdf-lib").PDFFont },
  outDoc: PDFDocument,
  renderCtx: Parameters<RecordRenderer["render"]>[1]
) {
  const { font, fontBold } = fonts
  const x = MARGIN
  const y = 504
  const w = PAGE_W - MARGIN * 2
  const rowH = 22
  const rows = 4
  const h = rowH * rows

  rect(ctx, x, y, w, h, 0.8)
  for (let i = 1; i < rows; i++) hLine(ctx, x, x + w, y + i * rowH, 0.45)

  // Row 1 splits (left status + signatures header)
  const r1a = x + 232 // code terminated by field end
  const r1b = x + 328 // date
  const sigSplit = x + 548
  ;[r1a, r1b, sigSplit].forEach((vx) => vLine(ctx, vx, y, y + rowH, 0.5))

  drawText(ctx, "Code terminated by:", { x: x + 6, y: y + 7, width: 78, font, size: 7 })
  drawText(ctx, d.code_terminated_by, { x: x + 82, y: y + 7, width: r1a - x - 88, font, size: 6.8, maxLength: 34 })
  drawText(ctx, "Date:", { x: r1a + 6, y: y + 7, width: 24, font, size: 7 })
  drawText(ctx, d.termination_date, { x: r1a + 30, y: y + 7, width: r1b - r1a - 36, font, size: 6.8, maxLength: 12 })
  drawText(ctx, "Patient:", { x: r1b + 6, y: y + 5, width: 30, font, size: 7 })
  drawCheckboxField(ctx, (d.patient_outcome ?? "").toLowerCase().includes("surviv"), r1b + 38, y + 10, "Survived", font, { labelWidth: 42, box: 6 })
  drawCheckboxField(ctx, (d.patient_outcome ?? "").toLowerCase().includes("expir"), r1b + 102, y + 10, "Expired", font, { labelWidth: 36, box: 6 })
  drawText(ctx, "Signatures", { x: sigSplit + 2, y: y + 6, width: x + w - sigSplit - 4, font: fontBold, size: 7.6, align: "center" })

  // Rows 2-4 splits
  const leftMid = x + 360
  const rightMid = sigSplit
  const sigMid = x + 666
  ;[leftMid, rightMid, sigMid].forEach((vx) => vLine(ctx, vx, y + rowH, y + h, 0.5))

  // left side rows
  drawText(ctx, "Transferred to:", { x: x + 6, y: y + rowH + 7, width: 62, font, size: 7 })
  drawText(ctx, d.transferred_to, { x: x + 66, y: y + rowH + 7, width: leftMid - x - 72, font, size: 6.8, maxLength: 42 })

  drawText(ctx, "Time:", { x: leftMid - 56, y: y + rowH + 7, width: 22, font, size: 7 })
  drawText(ctx, d.termination_time, { x: leftMid - 34, y: y + rowH + 7, width: 30, font, size: 6.8, maxLength: 10, align: "center" })

  drawText(ctx, "Neuro status on transfer:", { x: x + 6, y: y + rowH * 2 + 7, width: 110, font, size: 7 })
  drawText(ctx, d.neuro_status, { x: x + 114, y: y + rowH * 2 + 7, width: leftMid - x - 120, font, size: 6.8, maxLength: 56 })

  const leftSplitLast = x + 184
  vLine(ctx, leftSplitLast, y + rowH * 3, y + rowH * 4, 0.5)
  drawText(ctx, "Time Family Notified:", { x: x + 6, y: y + rowH * 3 + 7, width: 90, font, size: 7 })
  drawText(ctx, d.time_family_notified, { x: x + 94, y: y + rowH * 3 + 7, width: leftSplitLast - x - 100, font, size: 6.8, maxLength: 18 })
  drawText(ctx, "Time attending MD / Service Notified:", { x: leftSplitLast + 6, y: y + rowH * 3 + 7, width: 150, font, size: 7 })
  drawText(ctx, d.time_md_notified, { x: leftSplitLast + 154, y: y + rowH * 3 + 7, width: leftMid - leftSplitLast - 160, font, size: 6.8, maxLength: 18 })

  // right signature label rows and fields
  const sigLabelX = leftMid
  const sigValueX = rightMid
  const roleRows = [
    ["Team Leader:", "Recording RN:"],
    ["Respiratory Care Practitioner:", "Other:"],
    ["Medication RN:", "Other:"],
  ] as const

  // row 2,3,4 split left/right labels
  for (let i = 0; i < 3; i++) {
    const rowY = y + rowH * (i + 1)
    drawText(ctx, roleRows[i][0], {
      x: sigLabelX + 6,
      y: rowY + 7,
      width: 104,
      font,
      size: 5.8,
      maxLength: 28,
    })
    drawText(ctx, roleRows[i][1], {
      x: sigValueX + 6,
      y: rowY + 7,
      width: 50,
      font,
      size: 6.0,
      maxLength: 14,
    })
  }

  // Signature/name areas aligned with the two footer signature columns.
  const leftNameX = sigLabelX + 92
  const leftSigX = sigLabelX + 144
  const leftSigW = rightMid - leftSigX - 8
  const rightNameX = sigValueX + 58
  const rightSigX = sigMid + 4
  const rightSigW = x + w - rightSigX - 8

  // signature/name content boxes aligned with labels (6 positions)
  const sigs = d.signatures ?? []
  const sigBoxes = [
    { nameX: leftNameX, sigX: leftSigX, y: y + rowH + 4, w: leftSigW, nameW: leftSigX - leftNameX - 6 },
    { nameX: rightNameX, sigX: rightSigX, y: y + rowH + 4, w: rightSigW, nameW: sigMid - rightNameX - 6 },
    { nameX: leftNameX, sigX: leftSigX, y: y + rowH * 2 + 4, w: leftSigW, nameW: leftSigX - leftNameX - 6 },
    { nameX: rightNameX, sigX: rightSigX, y: y + rowH * 2 + 4, w: rightSigW, nameW: sigMid - rightNameX - 6 },
    { nameX: leftNameX, sigX: leftSigX, y: y + rowH * 3 + 4, w: leftSigW, nameW: leftSigX - leftNameX - 6 },
    { nameX: rightNameX, sigX: rightSigX, y: y + rowH * 3 + 4, w: rightSigW, nameW: sigMid - rightNameX - 6 },
  ]
  for (let i = 0; i < Math.min(sigs.length, sigBoxes.length); i++) {
    const s = sigs[i]
    const p = sigBoxes[i]
    drawText(ctx, s?.name ?? "", { x: p.nameX, y: p.y + 2, width: p.nameW, font, size: 5.4, maxLength: 18 })
    await drawSignatureInBox({
      outDoc,
      renderCtx,
      signatureValue: s?.signature,
      pageCtx: ctx,
      x: p.sigX,
      y: p.y,
      width: p.w,
      height: 13,
    })
  }
}

function drawBottomReminder(ctx: Ctx, fontBold: import("pdf-lib").PDFFont) {
  drawText(ctx, "PLEASE SAVE RHYTHM STRIPS IN CHART", {
    x: 0,
    y: 598,
    width: PAGE_W,
    font: fontBold,
    size: 7.8,
    align: "center",
  })
}

export const cardiacArrestRenderer: RecordRenderer<RenderJob<CardiacArrestRecordData>> = {
  async render(job, renderCtx): Promise<RenderedPdfPart> {
    const out = await PDFDocument.create()
    const [font, fontBold] = await Promise.all([
      out.embedFont(StandardFonts.Helvetica),
      out.embedFont(StandardFonts.HelveticaBold),
    ])

    const page = out.addPage([PAGE_W, PAGE_H])
    const ctx = createDrawContext(page, { debug: renderCtx.debug })
    const d = job.data

    drawTopSection(ctx, d, { font, fontBold })
    drawMainTable(ctx, d, { font, fontBold })
    await drawFooter(ctx, d, { font, fontBold }, out, renderCtx)
    drawBottomReminder(ctx, fontBold)

    return {
      bytes: await out.save(),
      pageCount: 1,
      description: `Cardiac arrest ${job.entry.log_date}`,
    }
  },
}
