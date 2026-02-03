"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { X, Eraser, Check, Undo2, ArrowUp, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type SignaturePadType from "signature_pad"

interface FullscreenSignaturePadProps {
  onSave: (data: { imageBlob: Blob; points: unknown; signerName: string }) => void
  onCancel: () => void
  disabled?: boolean
}

// Check if device is mobile-sized (cached at module level for perf)
function getIsMobile() {
  if (typeof window === "undefined") return false
  return window.innerWidth < 768
}

export function FullscreenSignaturePad({
  onSave,
  onCancel,
  disabled,
}: FullscreenSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<SignaturePadType | null>(null)
  const [step, setStep] = useState<"name" | "signature">("name")
  const [signerName, setSignerName] = useState("")
  const [isEmpty, setIsEmpty] = useState(true)
  const [canUndo, setCanUndo] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // Lazy init to avoid hydration mismatch (rendering-hydration-no-flicker)
  const [isMobile, setIsMobile] = useState(() => getIsMobile())
  const [isLandscape, setIsLandscape] = useState(false)

  // Detect orientation and mobile on mount (client-only)
  useEffect(() => {
    const checkOrientation = () => {
      const mobile = getIsMobile()
      setIsMobile(mobile)
      // On mobile, check if already in landscape
      if (mobile) {
        const landscape = window.innerWidth > window.innerHeight
        setIsLandscape(landscape)
      }
    }

    checkOrientation()
    window.addEventListener("resize", checkOrientation, { passive: true })
    return () => window.removeEventListener("resize", checkOrientation)
  }, [])

  // Lock body scroll when fullscreen signature is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // On mobile portrait, we rotate the UI 90deg so signing feels natural
  const shouldRotate = isMobile && !isLandscape

  useEffect(() => {
    // Only initialize when on signature step (canvas is rendered)
    if (step !== "signature") return

    let mounted = true

    async function initPad() {
      if (!canvasRef.current || !containerRef.current) return

      const SignaturePadLib = (await import("signature_pad")).default
      if (!mounted || !canvasRef.current) return

      const canvas = canvasRef.current
      const container = containerRef.current
      const pad = new SignaturePadLib(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        minWidth: 1.5,
        maxWidth: 3,
      })

      function resizeCanvas() {
        if (!canvas || !container) return
        const ratio = Math.max(window.devicePixelRatio || 1, 1)

        // When rotated, swap dimensions for canvas sizing
        if (shouldRotate) {
          // Canvas takes container dimensions (which are visually rotated)
          canvas.width = container.offsetWidth * ratio
          canvas.height = container.offsetHeight * ratio
        } else {
          canvas.width = container.offsetWidth * ratio
          canvas.height = container.offsetHeight * ratio
        }

        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.scale(ratio, ratio)
        }
        pad.clear()
      }

      resizeCanvas()
      window.addEventListener("resize", resizeCanvas, { passive: true })
      // Also handle orientation change
      window.addEventListener("orientationchange", () => {
        setTimeout(resizeCanvas, 100) // Delay for orientation to settle
      })

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
  }, [step, shouldRotate])

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
      data.pop()
      pad.fromData(data)
      setIsEmpty(pad.isEmpty())
      setCanUndo(data.length > 0)
    }
  }, [])

  const handleSave = useCallback(async () => {
    const pad = padRef.current
    if (!pad || pad.isEmpty() || !signerName.trim()) return

    const points = pad.toData()
    const dataUrl = pad.toDataURL("image/png")

    const response = await fetch(dataUrl)
    const blob = await response.blob()

    onSave({ imageBlob: blob, points, signerName: signerName.trim() })
  }, [onSave, signerName])

  // Step 1: Name input
  if (step === "name") {
    return (
      <div
        data-slot="fullscreen-signature-pad"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
          <div className="space-y-4">
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold">Sign Inspection</h2>
              <p className="text-sm text-muted-foreground">
                Please enter your full name, then sign to complete the inspection.
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
                onChange={(e) => setSignerName(e.target.value)}
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

  // Step 2: Signature capture
  return (
    <div
      data-slot="fullscreen-signature-pad"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      {/* Container - rotated on mobile portrait for landscape signing */}
      <div
        className={cn(
          "flex bg-background",
          shouldRotate
            ? // Rotated layout: swap dimensions and rotate
              "h-[100vw] w-[100vh] origin-center rotate-90 flex-col"
            : // Normal layout
              "h-full w-full flex-col md:h-[80vh] md:max-h-[600px] md:w-[90vw] md:max-w-2xl md:rounded-lg md:border md:shadow-lg"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => setStep("name")} disabled={disabled}>
            <X className="size-4" />
            <span className={cn(shouldRotate && "hidden sm:inline")}>Back</span>
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
            <span className={cn(shouldRotate && "hidden sm:inline")}>Done</span>
          </Button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="relative flex-1 bg-white">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ touchAction: "none" }}
          />

          {/* Loading state */}
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-muted-foreground">
              Loading…
            </div>
          )}

          {/* Empty state with signing hint */}
          {loaded && isEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground">
              <span className="text-lg">Sign here</span>
            </div>
          )}

          {/* Top indicator arrow - shows on rotated mobile view */}
          {shouldRotate && loaded && (
            <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 text-muted-foreground/50">
              <ArrowUp className="size-6" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Top</span>
            </div>
          )}

          {/* Baseline guide (subtle line where signature typically sits) */}
          <div
            className="pointer-events-none absolute left-8 right-8 border-b border-dashed border-muted-foreground/20"
            style={{ bottom: "30%" }}
          />
        </div>

        {/* Footer with undo and clear buttons */}
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
