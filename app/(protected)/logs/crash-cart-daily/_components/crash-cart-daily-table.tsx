"use client"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CRASH_CART_DAILY_ITEMS } from "@/lib/validations/log-entry"
import type { CrashCartDailyLogData } from "@/lib/validations/log-entry"
import { SignatureCell } from "../../narcotic/_components/signature-cell"

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

  function updateLockChange(index: number, field: "date_reason" | "new_lock", value: string) {
    const newChanges = data.lock_changes.map((lc, i) =>
      i === index ? { ...lc, [field]: value } : lc
    )
    onChange({ ...data, lock_changes: newChanges })
  }

  function updateSignature(index: number, field: string, value: string | null) {
    const newSigs = data.signatures.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
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
              {DAYS.map((d) => (
                <td key={d} className={cn(CELL, isDraft && data.initials[d] && "bg-yellow-50")}>
                  <input
                    type="text"
                    value={data.initials[d] || ""}
                    onChange={(e) => updateInitials(d, e.target.value)}
                    disabled={disabled}
                    className={TXT}
                    maxLength={4}
                  />
                </td>
              ))}
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
                    <th className={cn(HDR, "text-left min-w-[160px]")}>Name</th>
                    <th className={cn(HDR, "min-w-[120px]")}>Signature</th>
                    <th className={cn(HDR, "w-[80px]")}>Initials</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1].map((rowIdx) => {
                    const idx = half * 2 + rowIdx
                    const sig = data.signatures[idx]
                    if (!sig) return null
                    return (
                      <tr key={idx}>
                        <td className={cn(CELL, isDraft && sig.name && "bg-yellow-50")}>
                          <Input
                            type="text"
                            value={sig.name}
                            onChange={(e) => updateSignature(idx, "name", e.target.value)}
                            disabled={disabled}
                            className={cn(NOTES_TXT, "h-8")}
                          />
                        </td>
                        <td className={cn(CELL, "p-0.5", isDraft && sig.signature && "bg-yellow-50")}>
                          <SignatureCell
                            value={sig.signature}
                            onChange={(_storagePath, base64) =>
                              updateSignature(idx, "signature", base64)
                            }
                            locationId={locationId}
                            disabled={disabled}
                            signerName={sig.name}
                            onNameChange={(name) => updateSignature(idx, "name", name)}
                          />
                        </td>
                        <td className={cn(CELL, isDraft && sig.initials && "bg-yellow-50")}>
                          <Input
                            type="text"
                            value={sig.initials}
                            onChange={(e) => updateSignature(idx, "initials", e.target.value)}
                            disabled={disabled}
                            className={cn(TXT, "h-8")}
                            maxLength={5}
                          />
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
    </div>
  )
}
