"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { X, Eraser, Check, Undo2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trimCanvas } from "@/lib/trim-canvas"

interface FullscreenSignaturePadProps {
  onSave: (data: { imageBlob: Blob; points: unknown; signerName: string }) => void
  onCancel: () => void
  disabled?: boolean
  title?: string
  description?: string
  defaultSignerName?: string
}

interface StrokePoint {
  x: number
  y: number
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: StrokePoint[],
  color = "rgb(0, 0, 0)"
) {
  if (stroke.length === 0) return

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.lineWidth = 2.6

  if (stroke.length === 1) {
    const point = stroke[0]
    ctx.beginPath()
    ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(stroke[0].x, stroke[0].y)

  for (let index = 1; index < stroke.length - 1; index += 1) {
    const current = stroke[index]
    const next = stroke[index + 1]
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    ctx.quadraticCurveTo(current.x, current.y, midX, midY)
  }

  const last = stroke[stroke.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
  ctx.restore()
}

export function FullscreenSignaturePad({
  onSave,
  onCancel,
  disabled,
  title,
  description,
  defaultSignerName,
}: FullscreenSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const strokesRef = useRef<StrokePoint[][]>([])
  const activeStrokeRef = useRef<StrokePoint[] | null>(null)
  const [step, setStep] = useState<"name" | "signature">("name")
  const [signerName, setSignerName] = useState(defaultSignerName ?? "")
  const [loaded, setLoaded] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokeCount, setStrokeCount] = useState(0)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const isEmpty = strokeCount === 0
  const canUndo = strokeCount > 0

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "rgb(255, 255, 255)"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke)
    }

    if (activeStrokeRef.current) {
      drawStroke(ctx, activeStrokeRef.current)
    }
  }, [])

  useEffect(() => {
    if (step !== "signature") return

    const resizeCanvas = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const logicalWidth = container.offsetWidth
      const logicalHeight = container.offsetHeight

      canvas.width = Math.max(1, Math.floor(logicalWidth * ratio))
      canvas.height = Math.max(1, Math.floor(logicalHeight * ratio))
      canvas.style.width = `${logicalWidth}px`
      canvas.style.height = `${logicalHeight}px`

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(ratio, ratio)
      }

      redraw()
      setLoaded(true)
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas, { passive: true })
    window.addEventListener("orientationchange", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      window.removeEventListener("orientationchange", resizeCanvas)
    }
  }, [redraw, step])

  const getCanvasPoint = useCallback((event: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top

    return {
      x: localX * (canvas.width / rect.width),
      y: localY * (canvas.height / rect.height),
    }
  }, [])

  const commitActiveStroke = useCallback(() => {
    if (!activeStrokeRef.current || activeStrokeRef.current.length === 0) return

    strokesRef.current = [...strokesRef.current, activeStrokeRef.current]
    activeStrokeRef.current = null
    setStrokeCount(strokesRef.current.length)
    redraw()
  }, [redraw])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return

    const point = getCanvasPoint(event)
    if (!point) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    activeStrokeRef.current = [point]
    setIsDrawing(true)
    redraw()
  }, [disabled, getCanvasPoint, redraw])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return

    const point = getCanvasPoint(event)
    if (!point || !activeStrokeRef.current) return

    event.preventDefault()
    activeStrokeRef.current = [...activeStrokeRef.current, point]
    redraw()
  }, [disabled, getCanvasPoint, isDrawing, redraw])

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    event.preventDefault()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDrawing(false)
    commitActiveStroke()
  }, [commitActiveStroke, isDrawing])

  const handleClear = useCallback(() => {
    strokesRef.current = []
    activeStrokeRef.current = null
    setStrokeCount(0)
    redraw()
  }, [redraw])

  const handleUndo = useCallback(() => {
    if (strokesRef.current.length === 0) return

    strokesRef.current = strokesRef.current.slice(0, -1)
    setStrokeCount(strokesRef.current.length)
    redraw()
  }, [redraw])

  const handleSave = useCallback(async () => {
    if (disabled || isEmpty || !signerName.trim() || !canvasRef.current) return

    const trimmed = trimCanvas(canvasRef.current)
    const dataUrl = trimmed.toDataURL("image/png")
    const response = await fetch(dataUrl)
    const blob = await response.blob()

    onSave({
      imageBlob: blob,
      points: strokesRef.current,
      signerName: signerName.trim(),
    })
  }, [disabled, isEmpty, onSave, signerName])

  if (step === "name") {
    return (
      <div
        data-slot="fullscreen-signature-pad"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
          <div className="space-y-4">
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold">{title || "Sign Inspection"}</h2>
              <p className="text-sm text-muted-foreground">
                {description || "Please enter your full name, then sign to complete."}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="signer-name" className="text-sm font-medium">
                Full Name (printed)
              </label>
              <Input
                id="signer-name"
                type="text"
                placeholder="Enter your full name"
                value={signerName}
                onChange={(event) => setSignerName(event.target.value)}
                disabled={disabled}
                autoFocus
                className="h-12 text-base"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={disabled}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep("signature")}
                disabled={!signerName.trim() || disabled}
              >
                Continue to Sign
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      data-slot="fullscreen-signature-pad"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        className="flex h-full w-full flex-col bg-background md:h-[80vh] md:max-h-[600px] md:w-[90vw] md:max-w-2xl md:rounded-lg md:border md:shadow-lg"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => setStep("name")} disabled={disabled}>
            <X className="size-4" />
            <span>Back</span>
          </Button>
          <div className="text-center">
            <span className="text-sm font-medium">Sign as: {signerName}</span>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isEmpty || disabled}
          >
            <Check className="size-4" />
            <span>Done</span>
          </Button>
        </div>

        <div ref={containerRef} className="relative flex-1 overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="absolute left-1/2 top-1/2 touch-none"
            style={{
              touchAction: "none",
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
          />

          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-muted-foreground">
              Loading...
            </div>
          )}

          {loaded && isEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground">
              <span className="text-lg">Sign here</span>
            </div>
          )}

          <div
            className="pointer-events-none absolute left-8 right-8 border-b border-dashed border-muted-foreground/20"
            style={{ bottom: "30%" }}
          />
        </div>

        <div className="flex shrink-0 items-center justify-center gap-3 border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo || disabled}
          >
            <Undo2 className="size-4" />
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={isEmpty || disabled}
          >
            <Eraser className="size-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
