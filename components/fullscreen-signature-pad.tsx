"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { X, Eraser, Check, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type SignaturePadType from "signature_pad"

interface FullscreenSignaturePadProps {
  onSave: (data: { imageBlob: Blob; points: unknown }) => void
  onCancel: () => void
  disabled?: boolean
}

export function FullscreenSignaturePad({
  onSave,
  onCancel,
  disabled,
}: FullscreenSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadType | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [canUndo, setCanUndo] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Lock body scroll when fullscreen signature is open
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function initPad() {
      if (!canvasRef.current) return

      const SignaturePadLib = (await import("signature_pad")).default
      if (!mounted || !canvasRef.current) return

      const canvas = canvasRef.current
      const pad = new SignaturePadLib(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        minWidth: 1.5,
        maxWidth: 3,
      })

      function resizeCanvas() {
        if (!canvas) return
        const ratio = Math.max(window.devicePixelRatio || 1, 1)
        canvas.width = canvas.offsetWidth * ratio
        canvas.height = canvas.offsetHeight * ratio
        canvas.getContext("2d")?.scale(ratio, ratio)
        pad.clear()
      }

      resizeCanvas()
      window.addEventListener("resize", resizeCanvas, { passive: true })

      pad.addEventListener("endStroke", () => {
        if (mounted) {
          setIsEmpty(pad.isEmpty())
          setCanUndo(pad.toData().length > 0)
        }
      })

      padRef.current = pad
      setLoaded(true)

      return () => {
        window.removeEventListener("resize", resizeCanvas)
        pad.off()
      }
    }

    initPad()
    return () => {
      mounted = false
    }
  }, [])

  const handleClear = useCallback(() => {
    padRef.current?.clear()
    setIsEmpty(true)
    setCanUndo(false)
  }, [])

  const handleUndo = useCallback(() => {
    const pad = padRef.current
    if (!pad) return

    const data = pad.toData()
    if (data.length > 0) {
      data.pop() // Remove last stroke
      pad.fromData(data)
      setIsEmpty(pad.isEmpty())
      setCanUndo(data.length > 0)
    }
  }, [])

  const handleSave = useCallback(async () => {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) return

    const points = pad.toData()
    const dataUrl = pad.toDataURL("image/png")

    const response = await fetch(dataUrl)
    const blob = await response.blob()

    onSave({ imageBlob: blob, points })
  }, [onSave])

  return (
    <div
      data-slot="fullscreen-signature-pad"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      {/* Container - full screen on mobile, modal on desktop */}
      <div className="flex h-full w-full flex-col bg-background md:h-[80vh] md:max-h-[600px] md:w-[90vw] md:max-w-2xl md:rounded-lg md:border md:shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={disabled}>
            <X className="size-4" />
            Cancel
          </Button>
          <span className="text-sm font-medium">Sign to Complete</span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isEmpty || disabled}
          >
            <Check className="size-4" />
            Done
          </Button>
        </div>

        {/* Canvas area */}
        <div className="relative flex-1 bg-white md:rounded-none">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ touchAction: "none" }}
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
        </div>

        {/* Footer with undo and clear buttons */}
        <div className="flex items-center justify-center gap-3 border-t px-4 py-3">
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
