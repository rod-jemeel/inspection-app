import "server-only"
import { degrees, PDFPage, type PDFFont, type PDFImage, rgb, type RGB } from "pdf-lib"

export interface DrawContext {
  page: PDFPage
  pageWidth: number
  pageHeight: number
  visualRotation: 0 | 90 | 180 | 270
  debug?: boolean
}

function toPdfPoint(ctx: DrawContext, x: number, y: number): { x: number; y: number } {
  const w = ctx.pageWidth
  const h = ctx.pageHeight
  switch (ctx.visualRotation) {
    case 0:
      return { x, y: h - y }
    case 90:
      return { x: y, y: x }
    case 180:
      return { x: w - x, y }
    case 270:
      return { x: w - y, y: h - x }
    default:
      return { x, y: h - y }
  }
}

function normalizeText(value: unknown, maxLength?: number): string {
  const str = value == null ? "" : String(value)
  const clean = str.replace(/\s+/g, " ").trim()
  if (!maxLength || clean.length <= maxLength) return clean
  return `${clean.slice(0, Math.max(0, maxLength - 1))}\u2026`
}

function sanitizePdfText(text: string): string {
  return text
    .replace(/[✓✔☑]/g, "X")
    .replace(/\u2026/g, "...")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    // Standard fonts in pdf-lib use WinAnsi; strip characters outside that range.
    .replace(/[^\u0020-\u00FF]/g, "")
}

export function createDrawContext(
  page: PDFPage,
  opts?: { visualRotation?: 0 | 90 | 180 | 270; debug?: boolean }
): DrawContext {
  return {
    page,
    pageWidth: page.getWidth(),
    pageHeight: page.getHeight(),
    visualRotation: opts?.visualRotation ?? 0,
    debug: opts?.debug,
  }
}

export function drawText(
  ctx: DrawContext,
  value: unknown,
  opts: {
    x: number
    y: number
    font: PDFFont
    width?: number
    size?: number
    align?: "left" | "center" | "right"
    color?: RGB
    rotate?: 0 | 90 | 180 | 270
    maxLength?: number
  }
) {
  let text = sanitizePdfText(normalizeText(value, opts.maxLength))
  if (!text) return
  const size = opts.size ?? 9
  let x = opts.x
  if (opts.width) {
    try {
      const textWidth = opts.font.widthOfTextAtSize(text, size)
      if (opts.align === "center") x += Math.max(0, (opts.width - textWidth) / 2)
      if (opts.align === "right") x += Math.max(0, opts.width - textWidth)
    } catch {
      text = text.replace(/[^\u0020-\u007E]/g, "")
      if (!text) return
      const textWidth = opts.font.widthOfTextAtSize(text, size)
      if (opts.align === "center") x += Math.max(0, (opts.width - textWidth) / 2)
      if (opts.align === "right") x += Math.max(0, opts.width - textWidth)
    }
  }
  const p = toPdfPoint(ctx, x, opts.y)
  ctx.page.drawText(text, {
    x: p.x,
    y: p.y - size,
    font: opts.font,
    size,
    color: opts.color ?? rgb(0, 0, 0),
    rotate: degrees(opts.rotate ?? 0),
  })
}

export function drawCheckbox(
  ctx: DrawContext,
  checked: boolean,
  x: number,
  y: number,
  size = 8,
  font?: PDFFont
) {
  if (!checked) return
  if (font) {
    drawText(ctx, "X", { x, y, font, size: size + 1 })
    return
  }
  const p = toPdfPoint(ctx, x, y)
  ctx.page.drawLine({ start: { x: p.x, y: p.y }, end: { x: p.x + size, y: p.y - size }, thickness: 1 })
  ctx.page.drawLine({ start: { x: p.x + size, y: p.y }, end: { x: p.x, y: p.y - size }, thickness: 1 })
}

export function drawImageBox(
  ctx: DrawContext,
  image: PDFImage | null,
  opts: { x: number; y: number; width: number; height: number; fit?: "contain" | "cover" }
) {
  if (!image) return
  const fit = opts.fit ?? "contain"
  const scale = fit === "contain"
    ? Math.min(opts.width / image.width, opts.height / image.height)
    : Math.max(opts.width / image.width, opts.height / image.height)
  const drawW = image.width * scale
  const drawH = image.height * scale
  const drawX = opts.x + (opts.width - drawW) / 2
  const drawY = opts.y + (opts.height - drawH) / 2
  const p = toPdfPoint(ctx, drawX, drawY)
  ctx.page.drawImage(image, { x: p.x, y: p.y - drawH, width: drawW, height: drawH })
}

export function drawDebugBox(ctx: DrawContext, x: number, y: number, width: number, height: number) {
  if (!ctx.debug) return
  const p = toPdfPoint(ctx, x, y)
  ctx.page.drawRectangle({
    x: p.x,
    y: p.y - height,
    width,
    height,
    borderColor: rgb(1, 0, 0),
    borderWidth: 0.5,
    opacity: 0.7,
  })
}
