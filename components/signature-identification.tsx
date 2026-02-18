"use client"

import { UserPen } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SignatureCell } from "@/app/(protected)/logs/narcotic/_components/signature-cell"
import { useMySignature } from "@/hooks/use-my-signature"
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

export function SignatureIdentification({
  signatures,
  onChange,
  locationId,
  disabled = false,
  maxRows = 8,
  columns = 2,
}: SignatureIdentificationProps) {
  const { profile: myProfile } = useMySignature()

  function updateSignature(index: number, field: keyof SignatureEntry, value: string | null) {
    const updated = [...signatures]
    updated[index] = { ...updated[index], [field]: value ?? "" }
    onChange(updated)
  }

  /** Apply my profile name + initials to a specific row (user still signs manually — fraud prevention) */
  function applyMySignatureToRow(globalIndex: number) {
    if (!myProfile || disabled) return
    const updated = [...signatures]
    updated[globalIndex] = {
      ...updated[globalIndex],
      name: myProfile.name,
      initials: myProfile.default_initials,
    }
    onChange(updated)
  }

  /**
   * Called when user finishes drawing their signature.
   * If the signer name typed in the pad matches the logged-in profile,
   * also auto-fill the initials column.
   */
  function handleSignatureSaved(globalIndex: number, signerName: string) {
    if (!signerName) return
    const updated = [...signatures]
    updated[globalIndex] = {
      ...updated[globalIndex],
      name: signerName,
      initials:
        myProfile && signerName === myProfile.name
          ? myProfile.default_initials
          : updated[globalIndex].initials,
    }
    onChange(updated)
  }

  // Split signatures into columns
  const rowsPerColumn = Math.ceil(maxRows / columns)
  const columnGroups: SignatureEntry[][] = []
  for (let i = 0; i < columns; i++) {
    const start = i * rowsPerColumn
    const end = start + rowsPerColumn
    columnGroups.push(signatures.slice(start, end))
  }

  const canApply = !!myProfile && !disabled

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Signature Identification
      </h4>

      {/* Column layout */}
      <div className={cn("grid gap-4", columns === 2 && "grid-cols-1 xl:grid-cols-2")}>
        {columnGroups.map((group, colIndex) => (
          <table key={colIndex} className="w-full border-collapse">
            <thead>
              <tr>
                <th className={cn(HDR, "w-[38%]")}>Name</th>
                <th className={cn(HDR, "w-[40%]")}>Signature</th>
                <th className={cn(HDR, "w-[22%]")}>Initials</th>
              </tr>
            </thead>
            <tbody>
              {group.map((sig, localIndex) => {
                const globalIndex = colIndex * rowsPerColumn + localIndex
                const hasName = sig.name.trim() !== ""
                const hasInitials = sig.initials.trim() !== ""

                return (
                  <tr key={globalIndex}>
                    {/* Name cell — read-only span when filled, input when empty; "Apply" icon always visible when profile available */}
                    <td className={CELL}>
                      <div className="relative flex items-center gap-1">
                        {hasName && !disabled ? (
                          <span
                            className="flex-1 truncate text-xs leading-7 min-w-0 cursor-default"
                            title={sig.name}
                          >
                            {sig.name}
                          </span>
                        ) : (
                          <Input
                            type="text"
                            value={sig.name}
                            onChange={(e) => updateSignature(globalIndex, "name", e.target.value)}
                            disabled={disabled}
                            className={cn(TXT, "flex-1 min-w-0")}
                            placeholder="Name"
                          />
                        )}
                        {canApply && (
                          <button
                            type="button"
                            title="Apply my name & initials"
                            onClick={() => applyMySignatureToRow(globalIndex)}
                            className="shrink-0 flex items-center justify-center size-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
                            tabIndex={-1}
                          >
                            <UserPen className="size-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Signature cell — user must draw manually (fraud prevention) */}
                    <td className={CELL}>
                      <SignatureCell
                        value={sig.signature}
                        onChange={(_path, base64) =>
                          updateSignature(globalIndex, "signature", base64)
                        }
                        locationId={locationId}
                        disabled={disabled}
                        defaultSignerName={myProfile?.name}
                        hideSignerName
                        onNameChange={(name) => handleSignatureSaved(globalIndex, name)}
                      />
                    </td>

                    {/* Initials cell — read-only span when filled, input when empty */}
                    <td className={CELL}>
                      {hasInitials && !disabled ? (
                        <span className="block w-full text-center text-xs leading-7 cursor-default">
                          {sig.initials}
                        </span>
                      ) : (
                        <Input
                          type="text"
                          value={sig.initials}
                          onChange={(e) =>
                            updateSignature(globalIndex, "initials", e.target.value)
                          }
                          disabled={disabled}
                          maxLength={5}
                          className={cn(TXT, "text-center")}
                          placeholder="Init."
                        />
                      )}
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
