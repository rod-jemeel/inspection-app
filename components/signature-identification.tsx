"use client"

import { useState } from "react"
import { UserPen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SignatureCell } from "@/app/(protected)/logs/narcotic/_components/signature-cell"
import { cn } from "@/lib/utils"

const B = "border border-foreground/25"
const HDR = `${B} bg-muted/30 px-2 py-2 text-xs font-semibold text-center`
const CELL = `${B} px-1.5 py-1.5`
const TXT = "h-7 w-full text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"

export interface SignatureEntry {
  name: string
  signature: string | null
  initials: string
}

interface SignatureIdentificationProps {
  signatures: SignatureEntry[]
  onChange: (signatures: SignatureEntry[]) => void
  locationId: string
  disabled?: boolean
  maxRows?: number
  columns?: number
}

interface CachedProfile {
  name: string
  signature_image: string | null
  default_initials: string
}

export function SignatureIdentification({
  signatures,
  onChange,
  locationId,
  disabled = false,
  maxRows = 8,
  columns = 2,
}: SignatureIdentificationProps) {
  const [cachedProfile, setCachedProfile] = useState<CachedProfile | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  function updateSignature(index: number, field: keyof SignatureEntry, value: string | null) {
    const updated = [...signatures]
    updated[index] = { ...updated[index], [field]: value ?? "" }
    onChange(updated)
  }

  async function applyMySignature() {
    if (disabled) return

    try {
      setIsApplying(true)

      // Fetch profile if not cached
      let profile = cachedProfile
      if (!profile) {
        const res = await fetch("/api/users/me/signature")
        if (!res.ok) {
          alert("Failed to fetch signature")
          return
        }
        const data = await res.json()
        profile = {
          name: data.name || "",
          signature_image: data.signature_image,
          default_initials: data.default_initials || "",
        }
        setCachedProfile(profile)
      }

      // Find first empty row
      const emptyIndex = signatures.findIndex((sig) => !sig.name.trim())
      if (emptyIndex === -1) {
        alert("No empty rows available")
        return
      }

      // Apply signature to empty row
      const updated = [...signatures]
      updated[emptyIndex] = {
        name: profile.name,
        signature: profile.signature_image,
        initials: profile.default_initials,
      }
      onChange(updated)
    } catch (error) {
      console.error("Failed to apply signature:", error)
      alert("Failed to apply signature")
    } finally {
      setIsApplying(false)
    }
  }

  // Split signatures into columns
  const rowsPerColumn = Math.ceil(maxRows / columns)
  const columnGroups: SignatureEntry[][] = []
  for (let i = 0; i < columns; i++) {
    const start = i * rowsPerColumn
    const end = start + rowsPerColumn
    columnGroups.push(signatures.slice(start, end))
  }

  return (
    <div className="space-y-2">
      {/* Header with "Apply My Signature" button */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Signature Identification
        </h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={applyMySignature}
          disabled={disabled || isApplying}
          className="h-7 text-xs"
        >
          <UserPen className="mr-1.5 size-3.5" />
          Apply My Signature
        </Button>
      </div>

      {/* Column layout */}
      <div className={cn("grid gap-4", columns === 2 && "grid-cols-1 xl:grid-cols-2")}>
        {columnGroups.map((group, colIndex) => (
          <table key={colIndex} className="w-full border-collapse">
            <thead>
              <tr>
                <th className={cn(HDR, "w-[35%]")}>Name</th>
                <th className={cn(HDR, "w-[40%]")}>Signature</th>
                <th className={cn(HDR, "w-[25%]")}>Initials</th>
              </tr>
            </thead>
            <tbody>
              {group.map((sig, localIndex) => {
                const globalIndex = colIndex * rowsPerColumn + localIndex
                return (
                  <tr key={globalIndex}>
                    <td className={CELL}>
                      <Input
                        type="text"
                        value={sig.name}
                        onChange={(e) => updateSignature(globalIndex, "name", e.target.value)}
                        disabled={disabled}
                        className={TXT}
                      />
                    </td>
                    <td className={CELL}>
                      <SignatureCell
                        value={sig.signature}
                        onChange={(_path, base64) =>
                          updateSignature(globalIndex, "signature", base64)
                        }
                        locationId={locationId}
                        disabled={disabled}
                      />
                    </td>
                    <td className={CELL}>
                      <Input
                        type="text"
                        value={sig.initials}
                        onChange={(e) => updateSignature(globalIndex, "initials", e.target.value)}
                        disabled={disabled}
                        maxLength={5}
                        className={cn(TXT, "text-center")}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}
