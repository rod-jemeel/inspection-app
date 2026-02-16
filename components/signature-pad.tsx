"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Eraser, Check, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { trimCanvas } from "@/lib/trim-canvas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type SignaturePadType from "signature_pad"

interface SignaturePadProps {
  onSave: (data: { imageBlob: Blob; points: unknown; signerName: string }) => void
  onCancel?: () => void
  disabled?: boolean
  className?: string
}

export function SignaturePad({ onSave, onCancel, disabled, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadType | null>(null)
  const [step, setStep] = useState<"name" | "signature">("name")
  const [signerName, setSignerName] = useState("")
  const [isEmpty, setIsEmpty] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let mounted = true

    async function initPad() {
      if (!canvasRef.current) return

      // Dynamic import to avoid SSR issues and reduce bundle
      const SignaturePadLib = (await import("signature_pad")).default
      if (!mounted || !canvasRef.current) return

      const canvas = canvasRef.current
      const pad = new SignaturePadLib(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        minWidth: 1,
        maxWidth: 2.5,
      })

      // Handle resize
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
        if (mounted) setIsEmpty(pad.isEmpty())
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
  }, [])

  const handleSave = useCallback(async () => {
    const pad = padRef.current
    if (!pad || pad.isEmpty() || !signerName.trim()) return

    const points = pad.toData()

    // Trim whitespace around signature before exporting
    const trimmed = trimCanvas(canvasRef.current!)
    const dataUrl = trimmed.toDataURL("image/png")

    // Convert data URL to Blob
    const response = await fetch(dataUrl)
    const blob = await response.blob()

    onSave({ imageBlob: blob, points, signerName: signerName.trim() })
  }, [onSave, signerName])

  // Step 1: Name input
  if (step === "name") {
    return (
      <div data-slot="signature-pad" className={cn("flex flex-col gap-3", className)}>
        <div className="space-y-2">
          <label htmlFor="signer-name-inline" className="text-xs font-medium">
            Full Name (printed)
          </label>
          <Input
            id="signer-name-inline"
            type="text"
            placeholder="Enter your full name"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            disabled={disabled}
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={disabled}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => setStep("signature")}
            disabled={!signerName.trim() || disabled}
            className="flex-1"
          >
            Continue to Sign
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Step 2: Signature capture
  return (
    <div data-slot="signature-pad" className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs text-muted-foreground">Signing as: <span className="font-medium text-foreground">{signerName}</span></p>
      <div className="relative rounded-none border border-input bg-background">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none cursor-crosshair"
          style={{ touchAction: "none" }}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background text-xs text-muted-foreground">
            Loading...
          </div>
        )}
        {loaded && isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Sign here
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setStep("name")}
          disabled={disabled}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty || disabled}
        >
          <Eraser className="size-3.5" />
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isEmpty || disabled}
          className="flex-1"
        >
          <Check className="size-3.5" />
          Save Signature
        </Button>
      </div>
    </div>
  )
}
