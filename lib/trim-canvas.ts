/**
 * Trims whitespace around drawn content on a canvas.
 * Returns a new canvas cropped to the signature bounds with padding.
 */
export function trimCanvas(canvas: HTMLCanvasElement, padding = 10): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  // Find bounding box of non-white pixels
  let top = height
  let bottom = 0
  let left = width
  let right = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      // Check if pixel is not white (allowing slight tolerance)
      if (r < 250 || g < 250 || b < 250) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }

  // If no non-white pixels found, return original
  if (top >= bottom || left >= right) return canvas

  // Add padding
  const cropX = Math.max(0, left - padding)
  const cropY = Math.max(0, top - padding)
  const cropWidth = Math.min(width - cropX, right - left + padding * 2)
  const cropHeight = Math.min(height - cropY, bottom - top + padding * 2)

  const trimmed = document.createElement("canvas")
  trimmed.width = cropWidth
  trimmed.height = cropHeight

  const trimmedCtx = trimmed.getContext("2d")
  if (!trimmedCtx) return canvas

  // Fill with white background first
  trimmedCtx.fillStyle = "rgb(255, 255, 255)"
  trimmedCtx.fillRect(0, 0, cropWidth, cropHeight)

  // Draw the cropped region
  trimmedCtx.drawImage(
    canvas,
    cropX, cropY, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  )

  return trimmed
}
