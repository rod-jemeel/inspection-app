"use client"

import { useState } from "react"
import { PenLine, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FullscreenSignaturePad } from "@/components/fullscreen-signature-pad"
import { cn } from "@/lib/utils"

interface MySignatureCardProps {
  initialSignature: string | null
  initialInitials: string | null
}

export function MySignatureCard({ initialSignature, initialInitials }: MySignatureCardProps) {
  const [signatureImage, setSignatureImage] = useState<string | null>(initialSignature)
  const [initials, setInitials] = useState(initialInitials || "")
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle")

  const handleSignatureSave = (result: { imageBlob: Blob; points: unknown; signerName: string }) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setSignatureImage(base64)
      setShowSignaturePad(false)
    }
    reader.readAsDataURL(result.imageBlob)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveState("idle")

    try {
      const res = await fetch("/api/users/me/signature", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_image: signatureImage,
          default_initials: initials,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to save signature")
      }

      setSaveState("success")
      setTimeout(() => setSaveState("idle"), 3000)
    } catch (error) {
      console.error("Failed to save signature:", error)
      setSaveState("error")
      setTimeout(() => setSaveState("idle"), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    setSaveState("idle")

    try {
      const res = await fetch("/api/users/me/signature", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_image: null,
          default_initials: null,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to clear signature")
      }

      setSignatureImage(null)
      setInitials("")
      setSaveState("success")
      setTimeout(() => setSaveState("idle"), 3000)
    } catch (error) {
      console.error("Failed to clear signature:", error)
      setSaveState("error")
      setTimeout(() => setSaveState("idle"), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>My Signature</CardTitle>
          <CardDescription>
            Your saved signature and initials for quick log signing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Signature preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Signature</label>
            <div className="flex h-32 items-center justify-center rounded-md border bg-muted/50">
              {signatureImage ? (
                <img
                  src={signatureImage}
                  alt="Signature"
                  className="h-full max-h-28 w-auto object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <PenLine className="size-8" />
                  <span className="text-xs">No signature saved</span>
                </div>
              )}
            </div>
          </div>

          {/* Initials input */}
          <div className="space-y-2">
            <label htmlFor="default-initials" className="text-sm font-medium">
              Default Initials
            </label>
            <Input
              id="default-initials"
              type="text"
              placeholder="e.g., JD"
              value={initials}
              onChange={(e) => setInitials(e.target.value.slice(0, 5))}
              maxLength={5}
              disabled={saving}
              className="h-10"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSignaturePad(true)}
              disabled={saving}
              className="flex-1"
            >
              <PenLine className="size-4" />
              {signatureImage ? "Update" : "Add"} Signature
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={saving || (!signatureImage && !initials)}
              className={cn(
                "flex-1",
                saveState === "success" && "bg-green-600 hover:bg-green-700",
                saveState === "error" && "bg-red-600 hover:bg-red-700"
              )}
            >
              <Save className="size-4" />
              {saveState === "success" ? "Saved!" : saveState === "error" ? "Error" : "Save"}
            </Button>
            {(signatureImage || initials) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={saving}
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {showSignaturePad && (
        <FullscreenSignaturePad
          onSave={handleSignatureSave}
          onCancel={() => setShowSignaturePad(false)}
          title="Update Your Signature"
          description="This signature will be used when signing inspection logs."
        />
      )}
    </>
  )
}
