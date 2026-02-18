"use client"

import { useState } from "react"
import { UserPen, PenLine, Eye, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CRASH_CART_DAILY_ITEMS } from "@/lib/validations/log-entry"
import type { CrashCartDailyLogData, InitialsAudit } from "@/lib/validations/log-entry"
import { SignatureCell } from "../../narcotic/_components/signature-cell"
import { useMySignature } from "@/hooks/use-my-signature"
import { FullscreenSignaturePad } from "@/components/fullscreen-signature-pad"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CrashCartDailyTableProps {
  data: CrashCartDailyLogData
  onChange: (data: CrashCartDailyLogData) => void
  locationId: string
  disabled?: boolean
  isDraft?: boolean
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const B = "border border-foreground/25"
const HDR = `${B} bg-muted/30 px-1 py-1 text-[11px] md:text-xs font-semibold text-center`
const CELL = `${B} px-0 py-0`
const TXT =
  "h-7 md:h-8 w-full text-center text-[11px] md:text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring rounded-none"
const NOTES_TXT =
  "h-7 md:h-8 w-full text-left text-[11px] md:text-xs px-1 border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring rounded-none"

// ---------------------------------------------------------------------------
// Days array 1..31
// ---------------------------------------------------------------------------

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1))

// ---------------------------------------------------------------------------
// Bottom info labels (read-only text)
// ---------------------------------------------------------------------------

const BOTTOM_LABELS = [
  "AED unit - area clean without spills, clear access to controls",
  "Pad/Cable - package intact",
  "Supplies On AED",
  "Crash Cart Seal Intact - checked and serial number recorded (if changed)",
]

// ---------------------------------------------------------------------------
// Lock digit row labels
// ---------------------------------------------------------------------------

const LOCK_ROW_COUNT = 3

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrashCartDailyTable({
  data,
  onChange,
  locationId,
  disabled,
  isDraft,
}: CrashCartDailyTableProps) {
  const { profile: myProfile } = useMySignature()

  /** Day currently being signed (null = pad closed) */
  const [signingDay, setSigningDay] = useState<string | null>(null)
  /** Day whose audit trail is being viewed (null = dialog closed) */
  const [viewingDay, setViewingDay] = useState<string | null>(null)

  // -- Update helpers -------------------------------------------------------

  function updateCheck(itemKey: string, day: string, value: string) {
    onChange({
      ...data,
      checks: {
        ...data.checks,
        [itemKey]: { ...(data.checks[itemKey] || {}), [day]: value },
      },
    })
  }

  function updateNote(itemKey: string, value: string) {
    onChange({
      ...data,
      notes: { ...data.notes, [itemKey]: value },
    })
  }

  function updateLockDigit(rowIndex: number, day: string, value: string) {
    const newLockDigits: [Record<string, string>, Record<string, string>, Record<string, string>] = [
      { ...data.lock_digits[0] },
      { ...data.lock_digits[1] },
      { ...data.lock_digits[2] },
    ]
    newLockDigits[rowIndex] = { ...newLockDigits[rowIndex], [day]: value }
    onChange({ ...data, lock_digits: newLockDigits })
  }

  function updateInitials(day: string, value: string) {
    onChange({
      ...data,
      initials: { ...data.initials, [day]: value },
    })
  }

  function updateInitialsAudit(day: string, audit: InitialsAudit | null) {
    onChange({
      ...data,
      initials_signatures: { ...(data.initials_signatures ?? {}), [day]: audit },
    })
  }

  function updateInitialsAndAudit(day: string, value: string, audit: InitialsAudit | null) {
    onChange({
      ...data,
      initials: { ...data.initials, [day]: value },
      initials_signatures: { ...(data.initials_signatures ?? {}), [day]: audit },
    })
  }

  function updateLockChange(index: number, field: "date_reason" | "new_lock", value: string) {
    const newChanges = data.lock_changes.map((lc, i) =>
      i === index ? { ...lc, [field]: value } : lc
    )
    onChange({ ...data, lock_changes: newChanges })
  }

  function updateSignatureFields(
    index: number,
    fields: Partial<{ name: string; signature: string | null; initials: string }>
  ) {
    const newSigs = data.signatures.map((s, i) =>
      i === index ? { ...s, ...fields } : s
    )
    onChange({ ...data, signatures: newSigs })
  }

  function updateBottomNotes(value: string) {
    onChange({ ...data, bottom_notes: value })
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Main grid table */}
      <div className="overflow-x-auto max-w-full">
        <table className="w-full border-collapse">
          <thead>
            {/* Year + Month header row */}
            <tr>
              <th className={cn(HDR, "min-w-[180px] text-left sticky left-0 z-10 bg-muted")}>
                Year:
              </th>
              <th className={cn(HDR, "text-base font-bold")} colSpan={16}>
                {data.year}
              </th>
              <th className={cn(HDR, "text-right font-semibold")} colSpan={1}>
                Month:
              </th>
              <th className={cn(HDR, "text-base font-bold text-left")} colSpan={15}>
                {data.month}
              </th>
            </tr>
            {/* Day numbers header row */}
            <tr>
              <th className={cn(HDR, "min-w-[180px] text-left sticky left-0 z-10 bg-muted")}>
                Item
              </th>
              {DAYS.map((d) => (
                <th key={d} className={cn(HDR, "w-[32px] min-w-[32px]")}>
                  {d}
                </th>
              ))}
              <th className={cn(HDR, "min-w-[100px]")}>Notes</th>
            </tr>
          </thead>

          <tbody>
            {/* 7 check item rows */}
            {CRASH_CART_DAILY_ITEMS.map((item) => (
              <tr key={item.key} className="hover:bg-muted/10">
                <td
                  className={cn(
                    CELL,
                    "text-[10px] whitespace-nowrap px-1 py-0.5 sticky left-0 z-10 bg-background"
                  )}
                >
                  {item.label}
                </td>
                {DAYS.map((d) => (
                  <td key={d} className={cn(CELL, isDraft && data.checks[item.key]?.[d] && "bg-yellow-50")}>
                    <input
                      type="text"
                      value={data.checks[item.key]?.[d] || ""}
                      onChange={(e) => updateCheck(item.key, d, e.target.value)}
                      disabled={disabled}
                      className={TXT}
                      maxLength={3}
                    />
                  </td>
                ))}
                <td className={cn(CELL, isDraft && data.notes[item.key] && "bg-yellow-50")}>
                  <input
                    type="text"
                    value={data.notes[item.key] || ""}
                    onChange={(e) => updateNote(item.key, e.target.value)}
                    disabled={disabled}
                    className={NOTES_TXT}
                  />
                </td>
              </tr>
            ))}

            {/* 3 lock digit rows with merged label */}
            {Array.from({ length: LOCK_ROW_COUNT }, (_, rowIdx) => (
              <tr key={`lock-${rowIdx}`} className="hover:bg-muted/10">
                {rowIdx === 0 && (
                  <td
                    rowSpan={LOCK_ROW_COUNT}
                    className={cn(
                      CELL,
                      "text-[10px] px-1 py-0.5 font-semibold sticky left-0 z-10 bg-background align-middle"
                    )}
                  >
                    Last 3 digits of lock #
                  </td>
                )}
                {DAYS.map((d) => (
                  <td key={d} className={cn(CELL, isDraft && data.lock_digits[rowIdx]?.[d] && "bg-yellow-50")}>
                    <input
                      type="text"
                      value={data.lock_digits[rowIdx]?.[d] || ""}
                      onChange={(e) => updateLockDigit(rowIdx, d, e.target.value)}
                      disabled={disabled}
                      className={TXT}
                      maxLength={3}
                    />
                  </td>
                ))}
                {rowIdx === 0 && <td rowSpan={LOCK_ROW_COUNT} className={CELL} />}
              </tr>
            ))}

            {/* Initials row */}
            <tr className="hover:bg-muted/10">
              <td
                className={cn(
                  CELL,
                  "text-[10px] whitespace-nowrap px-1 py-0.5 font-semibold sticky left-0 z-10 bg-background"
                )}
              >
                Initials
              </td>
              {DAYS.map((d) => {
                const stamped = data.initials[d]
                const audit = data.initials_signatures?.[d]
                return (
                  <td key={d} className={cn(CELL, isDraft && stamped && "bg-yellow-50")}>
                    {stamped ? (
                      /* Stamped state — show initials + eye + optional clear */
                      <div className="flex items-center justify-center gap-0.5 h-7 md:h-8 px-0.5">
                        <span className="text-[11px] md:text-xs font-medium leading-none select-none">
                          {stamped}
                        </span>
                        {audit && (
                          <button
                            type="button"
                            onClick={() => setViewingDay(d)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                            title="View signature"
                          >
                            <Eye className="size-2.5" />
                          </button>
                        )}
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => updateInitialsAndAudit(d, "", null)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Clear initials"
                          >
                            <X className="size-2.5" />
                          </button>
                        )}
                      </div>
                    ) : !disabled ? (
                      /* Empty + editable — pen icon to open signature pad */
                      <div className="flex items-center justify-center h-7 md:h-8">
                        <button
                          type="button"
                          onClick={() => setSigningDay(d)}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                          title="Sign to stamp initials"
                        >
                          <PenLine className="size-3" />
                        </button>
                      </div>
                    ) : (
                      /* Empty + disabled — blank cell */
                      <div className="h-7 md:h-8" />
                    )}
                  </td>
                )
              })}
              <td className={CELL} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bottom info labels + Crash Cart Lock Numbers -- side by side */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Left: info labels as bordered table for consistency */}
        <div>
          <table className="w-full border-collapse">
            <tbody>
              {BOTTOM_LABELS.map((label, i) => (
                <tr key={i}>
                  <td className={cn(CELL, "px-2 py-2 text-xs")}>
                    {label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: Crash Cart Lock Numbers */}
        <div className="space-y-1">
          <h4 className="text-xs font-semibold">Crash Cart Lock Numbers</h4>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={cn(HDR, "text-left")}>Date Changed & Reason</th>
                <th className={cn(HDR, "text-left w-[100px]")}>New Lock #</th>
                <th className={cn(HDR, "text-left")}>Date Changed & Reason</th>
                <th className={cn(HDR, "text-left w-[100px]")}>New Lock #</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: entries 0 and 1 */}
              <tr>
                <td className={cn(CELL, isDraft && data.lock_changes[0]?.date_reason && "bg-yellow-50")}>
                  <Input
                    type="text"
                    value={data.lock_changes[0]?.date_reason || ""}
                    onChange={(e) => updateLockChange(0, "date_reason", e.target.value)}
                    disabled={disabled}
                    className={cn(NOTES_TXT, "h-7")}
                  />
                </td>
                <td className={cn(CELL, isDraft && data.lock_changes[0]?.new_lock && "bg-yellow-50")}>
                  <Input
                    type="text"
                    value={data.lock_changes[0]?.new_lock || ""}
                    onChange={(e) => updateLockChange(0, "new_lock", e.target.value)}
                    disabled={disabled}
                    className={cn(NOTES_TXT, "h-7")}
                  />
                </td>
                <td className={cn(CELL, isDraft && data.lock_changes[1]?.date_reason && "bg-yellow-50")}>
                  <Input
                    type="text"
                    value={data.lock_changes[1]?.date_reason || ""}
                    onChange={(e) => updateLockChange(1, "date_reason", e.target.value)}
                    disabled={disabled}
                    className={cn(NOTES_TXT, "h-7")}
                  />
                </td>
                <td className={cn(CELL, isDraft && data.lock_changes[1]?.new_lock && "bg-yellow-50")}>
                  <Input
                    type="text"
                    value={data.lock_changes[1]?.new_lock || ""}
                    onChange={(e) => updateLockChange(1, "new_lock", e.target.value)}
                    disabled={disabled}
                    className={cn(NOTES_TXT, "h-7")}
                  />
                </td>
              </tr>
              {/* Row 2: entries 2 and 3 */}
              <tr>
                <td className={cn(CELL, isDraft && data.lock_changes[2]?.date_reason && "bg-yellow-50")}>
                  <Input
                    type="text"
                    value={data.lock_changes[2]?.date_reason || ""}
                    onChange={(e) => updateLockChange(2, "date_reason", e.target.value)}
                    disabled={disabled}
                    className={cn(NOTES_TXT, "h-7")}
                  />
                </td>
                <td className={cn(CELL, isDraft && data.lock_changes[2]?.new_lock && "bg-yellow-50")}>
                  <Input
                    type="text"
                    value={data.lock_changes[2]?.new_lock || ""}
                    onChange={(e) => updateLockChange(2, "new_lock", e.target.value)}
                    disabled={disabled}
                    className={cn(NOTES_TXT, "h-7")}
                  />
                </td>
                <td className={cn(CELL, isDraft && data.lock_changes[3]?.date_reason && "bg-yellow-50")}>
                  <Input
                    type="text"
                    value={data.lock_changes[3]?.date_reason || ""}
                    onChange={(e) => updateLockChange(3, "date_reason", e.target.value)}
                    disabled={disabled}
                    className={cn(NOTES_TXT, "h-7")}
                  />
                </td>
                <td className={cn(CELL, isDraft && data.lock_changes[3]?.new_lock && "bg-yellow-50")}>
                  <Input
                    type="text"
                    value={data.lock_changes[3]?.new_lock || ""}
                    onChange={(e) => updateLockChange(3, "new_lock", e.target.value)}
                    disabled={disabled}
                    className={cn(NOTES_TXT, "h-7")}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Name / Signature / Initials table */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold">Name / Signature / Initials</h4>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[0, 1].map((half) => (
            <div key={half} className="overflow-x-auto max-w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={cn(HDR, "w-7 md:w-8")}>#</th>
                    <th className={cn(HDR, "text-left min-w-[140px]")}>Name</th>
                    <th className={cn(HDR, "min-w-[120px]")}>Signature</th>
                    <th className={cn(HDR, "w-[70px]")}>Initials</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1].map((rowIdx) => {
                    const idx = half * 2 + rowIdx
                    const sig = data.signatures[idx]
                    if (!sig) return null
                    return (
                      <tr key={idx}>
                        {/* # */}
                        <td className={cn(CELL, "text-center text-[11px] md:text-xs font-medium")}>
                          {idx + 1}
                        </td>
                        {/* Name */}
                        <td className={cn(CELL, isDraft && sig.name && "bg-yellow-50")}>
                          <div className="flex items-center gap-1 px-0.5">
                            {sig.name && !disabled ? (
                              <span className="flex-1 truncate text-[11px] md:text-xs leading-7 min-w-0 cursor-default px-0.5">
                                {sig.name}
                              </span>
                            ) : (
                              <Input
                                type="text"
                                value={sig.name}
                                onChange={(e) => updateSignatureFields(idx, { name: e.target.value })}
                                disabled={disabled}
                                placeholder="Name"
                                className="h-7 flex-1 min-w-0 text-[11px] md:text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                              />
                            )}
                            {myProfile && !disabled && (
                              <button
                                type="button"
                                title="Apply my name & initials"
                                onClick={() =>
                                  updateSignatureFields(idx, {
                                    name: myProfile.name,
                                    initials: myProfile.default_initials ?? "",
                                  })
                                }
                                className="shrink-0 flex items-center justify-center size-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
                                tabIndex={-1}
                              >
                                <UserPen className="size-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        {/* Signature */}
                        <td className={cn(CELL, "p-0.5", isDraft && sig.signature && "bg-yellow-50")}>
                          <SignatureCell
                            value={sig.signature}
                            onChange={(_storagePath, base64) =>
                              updateSignatureFields(idx, { signature: base64 })
                            }
                            locationId={locationId}
                            disabled={disabled}
                            defaultSignerName={myProfile?.name}
                            hideSignerName
                            onNameChange={(name) => {
                              if (name) {
                                updateSignatureFields(idx, {
                                  name,
                                  initials: myProfile?.default_initials ?? "",
                                })
                              } else {
                                updateSignatureFields(idx, { name: "", initials: "" })
                              }
                            }}
                          />
                        </td>
                        {/* Initials */}
                        <td className={cn(CELL, isDraft && sig.initials && "bg-yellow-50")}>
                          {sig.initials && !disabled ? (
                            <span className="block w-full text-center text-[11px] md:text-xs leading-7 cursor-default">
                              {sig.initials}
                            </span>
                          ) : (
                            <Input
                              type="text"
                              value={sig.initials}
                              onChange={(e) => updateSignatureFields(idx, { initials: e.target.value })}
                              disabled={disabled}
                              maxLength={5}
                              placeholder="Init."
                              className="h-7 w-full text-[11px] md:text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      {/* Notes textarea */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold">Notes</h4>
        <Textarea
          value={data.bottom_notes}
          onChange={(e) => updateBottomNotes(e.target.value)}
          disabled={disabled}
          rows={3}
          className="text-xs"
          placeholder="Additional notes..."
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sign-to-stamp: FullscreenSignaturePad                               */}
      {/* ------------------------------------------------------------------ */}
      {signingDay !== null && (
        <FullscreenSignaturePad
          title="Sign to stamp initials"
          description="Draw your signature below to confirm and stamp your initials for this day."
          defaultSignerName={myProfile?.name ?? ""}
          onCancel={() => setSigningDay(null)}
          onSave={({ imageBlob, signerName }) => {
            const day = signingDay
            setSigningDay(null)
            // Derive initials: prefer pre-configured default, else first letter of each word
            const initials =
              (myProfile?.default_initials?.trim()) ||
              signerName
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 4) ||
              "?"
            // Convert blob → base64 data URL then commit both at once
            const reader = new FileReader()
            reader.onloadend = () => {
              updateInitialsAndAudit(day, initials, {
                sig: reader.result as string,
                signed_at: new Date().toISOString(),
                signer_name: signerName,
              })
            }
            reader.readAsDataURL(imageBlob)
          }}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Audit view dialog                                                    */}
      {/* ------------------------------------------------------------------ */}
      {viewingDay !== null && (
        <Dialog open onOpenChange={() => setViewingDay(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">
                Initials Signature — Day {viewingDay}
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const audit = data.initials_signatures?.[viewingDay]
              if (!audit) {
                return (
                  <p className="text-xs text-muted-foreground">
                    No signature audit data available for this day.
                  </p>
                )
              }
              return (
                <div className="space-y-3">
                  {/* Signature image */}
                  <div className="border border-border rounded p-2 bg-muted/10 flex items-center justify-center min-h-[80px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={audit.sig}
                      alt="Drawn signature"
                      className="max-h-28 w-auto object-contain"
                    />
                  </div>
                  {/* Metadata */}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground font-medium">Signed by</dt>
                    <dd className="font-medium">{audit.signer_name || "—"}</dd>
                    <dt className="text-muted-foreground font-medium">Date &amp; time</dt>
                    <dd>
                      {audit.signed_at
                        ? new Date(audit.signed_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </dd>
                  </dl>
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
