"use client"

import { UserPen } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SignatureCell } from "@/app/(protected)/logs/narcotic/_components/signature-cell"
import { useMySignature } from "@/hooks/use-my-signature"
import { cn } from "@/lib/utils"

const B = "border border-foreground/25"
const HDR = `${B} bg-muted/30 px-2 py-2 text-center text-xs font-semibold`
const CELL = `${B} px-1.5 py-1.5`
const TXT =
  "h-7 w-full border-0 bg-transparent text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring"

export interface SignatureEntry {
  name: string
  signature: string | null
  initials: string
  signed_at: string
}

interface SignatureIdentificationProps {
  signatures: SignatureEntry[]
  onChange: (signatures: SignatureEntry[]) => void
  locationId: string
  disabled?: boolean
  maxRows?: number
  columns?: number
}

interface SignatureMeta {
  signerName: string
  signedAt: string
  signatureBase64?: string
}

function NameCell({
  entry,
  disabled,
  canApply,
  onApplyProfile,
  onNameChange,
}: {
  entry: SignatureEntry
  disabled: boolean
  canApply: boolean
  onApplyProfile: () => void
  onNameChange: (value: string) => void
}) {
  const hasName = entry.name.trim() !== ""

  return (
    <td className={CELL}>
      <div className="relative flex items-center gap-1">
        {hasName && !disabled ? (
          <span
            className="flex-1 min-w-0 cursor-default truncate text-xs leading-7"
            title={entry.name}
          >
            {entry.name}
          </span>
        ) : (
          <Input
            type="text"
            value={entry.name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={disabled}
            className={cn(TXT, "flex-1 min-w-0")}
            placeholder="Name"
          />
        )}
        {canApply && (
          <button
            type="button"
            title="Apply my name & initials"
            onClick={onApplyProfile}
            className="flex size-5 shrink-0 touch-manipulation items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            tabIndex={-1}
          >
            <UserPen className="size-3" />
          </button>
        )}
      </div>
    </td>
  )
}

function InitialsCell({
  entry,
  disabled,
  onInitialsChange,
}: {
  entry: SignatureEntry
  disabled: boolean
  onInitialsChange: (value: string) => void
}) {
  const hasInitials = entry.initials.trim() !== ""

  return (
    <td className={CELL}>
      {hasInitials && !disabled ? (
        <span className="block w-full cursor-default text-center text-xs leading-7">
          {entry.initials}
        </span>
      ) : (
        <Input
          type="text"
          value={entry.initials}
          onChange={(e) => onInitialsChange(e.target.value)}
          disabled={disabled}
          maxLength={5}
          className={cn(TXT, "text-center")}
          placeholder="Init."
        />
      )}
    </td>
  )
}

function SignatureGridRow({
  entry,
  disabled,
  locationId,
  myProfile,
  onApplyProfile,
  onNameChange,
  onInitialsChange,
  onSignatureMetaChange,
}: {
  entry: SignatureEntry
  disabled: boolean
  locationId: string
  myProfile: ReturnType<typeof useMySignature>["profile"]
  onApplyProfile: () => void
  onNameChange: (value: string) => void
  onInitialsChange: (value: string) => void
  onSignatureMetaChange: (meta: SignatureMeta | null) => void
}) {
  return (
    <tr>
      <NameCell
        entry={entry}
        disabled={disabled}
        canApply={!!myProfile && !disabled}
        onApplyProfile={onApplyProfile}
        onNameChange={onNameChange}
      />
      <td className={CELL}>
        <SignatureCell
          value={entry.signature}
          onChange={() => {}}
          locationId={locationId}
          disabled={disabled}
          defaultSignerName={myProfile?.name}
          hideSignerName
          signerName={entry.name}
          signedAt={entry.signed_at ?? ""}
          onSignedMetaChange={onSignatureMetaChange}
        />
      </td>
      <InitialsCell
        entry={entry}
        disabled={disabled}
        onInitialsChange={onInitialsChange}
      />
    </tr>
  )
}

function SignatureColumn({
  entries,
  startIndex,
  disabled,
  locationId,
  myProfile,
  onApplyProfile,
  onNameChange,
  onInitialsChange,
  onSignatureMetaChange,
}: {
  entries: SignatureEntry[]
  startIndex: number
  disabled: boolean
  locationId: string
  myProfile: ReturnType<typeof useMySignature>["profile"]
  onApplyProfile: (globalIndex: number) => void
  onNameChange: (globalIndex: number, value: string) => void
  onInitialsChange: (globalIndex: number, value: string) => void
  onSignatureMetaChange: (globalIndex: number, meta: SignatureMeta | null) => void
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={cn(HDR, "w-[38%]")}>Name</th>
          <th className={cn(HDR, "w-[40%]")}>Signature</th>
          <th className={cn(HDR, "w-[22%]")}>Initials</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, localIndex) => {
          const globalIndex = startIndex + localIndex

          return (
            <SignatureGridRow
              key={globalIndex}
              entry={entry}
              disabled={disabled}
              locationId={locationId}
              myProfile={myProfile}
              onApplyProfile={() => onApplyProfile(globalIndex)}
              onNameChange={(value) => onNameChange(globalIndex, value)}
              onInitialsChange={(value) => onInitialsChange(globalIndex, value)}
              onSignatureMetaChange={(meta) => onSignatureMetaChange(globalIndex, meta)}
            />
          )
        })}
      </tbody>
    </table>
  )
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

  function handleSignatureMetaChange(globalIndex: number, meta: SignatureMeta | null) {
    const updated = [...signatures]
    updated[globalIndex] = {
      ...updated[globalIndex],
      name: meta?.signerName ?? "",
      signature: meta?.signatureBase64 ?? null,
      initials:
        meta?.signerName && myProfile && meta.signerName === myProfile.name
          ? myProfile.default_initials
          : updated[globalIndex].initials,
      signed_at: meta?.signedAt ?? "",
    }
    onChange(updated)
  }

  const rowsPerColumn = Math.ceil(maxRows / columns)
  const columnGroups: SignatureEntry[][] = []
  for (let i = 0; i < columns; i++) {
    const start = i * rowsPerColumn
    const end = start + rowsPerColumn
    columnGroups.push(signatures.slice(start, end))
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Signature Identification
      </h4>

      <div className={cn("grid gap-4", columns === 2 && "grid-cols-1 xl:grid-cols-2")}>
        {columnGroups.map((group, colIndex) => (
          <SignatureColumn
            key={colIndex}
            entries={group}
            startIndex={colIndex * rowsPerColumn}
            disabled={disabled}
            locationId={locationId}
            myProfile={myProfile}
            onApplyProfile={applyMySignatureToRow}
            onNameChange={(globalIndex, value) => updateSignature(globalIndex, "name", value)}
            onInitialsChange={(globalIndex, value) => updateSignature(globalIndex, "initials", value)}
            onSignatureMetaChange={handleSignatureMetaChange}
          />
        ))}
      </div>
    </div>
  )
}
