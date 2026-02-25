"use client"

import { Fragment } from "react"
import { format } from "date-fns"
import { Plus, Trash2, CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { InitialsStampCell, type InitialsStampResult } from "@/components/initials-stamp-cell"
import type { SignatureEntry } from "@/components/signature-identification"
import { useMySignature } from "@/hooks/use-my-signature"
import { upsertSignerInSignatureIdentification } from "@/lib/signature-identification-utils"
import { cn } from "@/lib/utils"
import { NARCOTIC_COUNT_DRUGS } from "@/lib/validations/log-entry"
import type {
  DailyNarcoticCountLogData,
  InitialsAudit,
  NarcoticCountEntry,
  NarcoticCountInitialsAudits,
} from "@/lib/validations/log-entry"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NarcoticCountTableProps {
  data: DailyNarcoticCountLogData
  onChange: (data: DailyNarcoticCountLogData) => void
  locationId: string
  disabled?: boolean
  isDraft?: boolean
  sheetYear?: number
  sheetMonth?: number
}

// ---------------------------------------------------------------------------
// Shared cell style constants (matches narcotic-table.tsx)
// ---------------------------------------------------------------------------

const B = "border border-foreground/25"
const HDR = `${B} bg-muted/30 px-2 py-2 text-xs font-semibold text-center`
const CELL = `${B} px-1 py-1`
const TXT =
  "h-8 md:h-9 w-full text-center text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"

// How many date columns per set before wrapping to a new table section
const COLS_PER_SET = 4

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyEntry(): NarcoticCountEntry {
  return {
    date: "",
    fentanyl: { am: "", rcvd: "", used: "", pm: "" },
    midazolam: { am: "", rcvd: "", used: "", pm: "" },
    ephedrine: { am: "", rcvd: "", used: "", pm: "" },
    initials: "",
    initials_am: "",
    initials_am_2: "",
    initials_pm: "",
    initials_pm_2: "",
    initials_audits: { am_1: null, am_2: null, pm_1: null, pm_2: null },
  }
}

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  const [, y, m, d] = match
  const parsed = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

type NarcoticCountInitialsSlot = "am_1" | "am_2" | "pm_1" | "pm_2"

const SLOT_TO_FIELD: Record<NarcoticCountInitialsSlot, keyof Pick<
  NarcoticCountEntry,
  "initials_am" | "initials_am_2" | "initials_pm" | "initials_pm_2"
>> = {
  am_1: "initials_am",
  am_2: "initials_am_2",
  pm_1: "initials_pm",
  pm_2: "initials_pm_2",
}

function emptyInitialsAudits(): NarcoticCountInitialsAudits {
  return { am_1: null, am_2: null, pm_1: null, pm_2: null }
}

function getInitialsAudits(entry: NarcoticCountEntry): NarcoticCountInitialsAudits {
  return {
    ...emptyInitialsAudits(),
    ...(entry.initials_audits ?? {}),
  }
}

// ---------------------------------------------------------------------------
// Diagonal split cell (Rcvd top-left / Used bottom-right)
// ---------------------------------------------------------------------------

function DiagonalCell({
  rcvd,
  used,
  onRcvdChange,
  onUsedChange,
  disabled,
  isDraft,
  hasData,
}: {
  rcvd: string
  used: string
  onRcvdChange: (v: string) => void
  onUsedChange: (v: string) => void
  disabled?: boolean
  isDraft?: boolean
  hasData?: boolean
}) {
  return (
    <td className={cn(CELL, "relative p-0", isDraft && hasData && "bg-yellow-50")}>
      <div className="relative flex h-12 w-full flex-col items-center justify-between overflow-hidden">
        {/* Diagonal line: top-right to bottom-left */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <svg className="h-full w-full" preserveAspectRatio="none">
            <line
              x1="100%"
              y1="0"
              x2="0"
              y2="100%"
              stroke="currentColor"
              className="text-foreground/20"
              strokeWidth="1"
            />
          </svg>
        </div>
        {/* Rcvd (top-left) */}
        <input
          type="text"
          className="relative z-10 w-[36px] md:w-[44px] self-start bg-transparent pl-0.5 pt-0.5 text-[11px] tabular-nums text-center outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-ring"
          value={rcvd}
          onChange={(e) => onRcvdChange(e.target.value)}
          disabled={disabled}
          placeholder=""
        />
        {/* Used (bottom-right) */}
        <input
          type="text"
          className="relative z-10 w-[36px] md:w-[44px] self-end bg-transparent pb-0.5 pr-0.5 text-center text-[11px] tabular-nums font-semibold outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-ring"
          value={used}
          onChange={(e) => onUsedChange(e.target.value)}
          disabled={disabled}
          placeholder=""
        />
      </div>
    </td>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NarcoticCountTable({
  data,
  onChange,
  locationId,
  disabled,
  isDraft,
  sheetYear,
  sheetMonth,
}: NarcoticCountTableProps) {
  const { profile: myProfile } = useMySignature()

  function updateEntry(index: number, updates: Partial<NarcoticCountEntry>) {
    const entries = [...data.entries]
    entries[index] = { ...entries[index], ...updates }
    onChange({ ...data, entries })
  }

  function updateEntryWithSignatures(
    entryIndex: number,
    entryUpdates: Partial<NarcoticCountEntry>,
    signatures: SignatureEntry[],
  ) {
    const entries = [...data.entries]
    entries[entryIndex] = { ...entries[entryIndex], ...entryUpdates }
    onChange({ ...data, entries, signatures })
  }

  function updateDrugField(
    entryIndex: number,
    drugKey: "fentanyl" | "midazolam" | "ephedrine",
    field: "am" | "rcvd" | "used" | "pm",
    value: string
  ) {
    const entries = [...data.entries]
    entries[entryIndex] = {
      ...entries[entryIndex],
      [drugKey]: { ...entries[entryIndex][drugKey], [field]: value },
    }
    onChange({ ...data, entries })
  }

  function addColumn() {
    if (data.entries.length >= 31) return
    onChange({ ...data, entries: [...data.entries, emptyEntry()] })
  }

  function removeColumn(index: number) {
    if (data.entries.length <= 1) return
    onChange({ ...data, entries: data.entries.filter((_, i) => i !== index) })
  }

  function updateInitialsSlot(
    entryIndex: number,
    slot: NarcoticCountInitialsSlot,
    value: string,
    audit: InitialsAudit | null,
    signer?: InitialsStampResult["signer"],
  ) {
    const entry = data.entries[entryIndex]
    if (!entry) return

    const field = SLOT_TO_FIELD[slot]
    const initialsAudits = {
      ...getInitialsAudits(entry),
      [slot]: audit,
    }

    let nextSignatures = data.signatures
    if (signer) {
      const upserted = upsertSignerInSignatureIdentification(data.signatures, {
        name: signer.name,
        initials: signer.initials,
        signature: signer.signature,
      })

      nextSignatures = upserted.signatures

      if (upserted.status === "full") {
        toast.warning("Initials stamped, but Signature Identification is full. Add signer manually if needed.")
      }
    }

    updateEntryWithSignatures(entryIndex, {
      [field]: value,
      initials_audits: initialsAudits,
    } as Partial<NarcoticCountEntry>, nextSignatures)
  }

  // Chunk entries into sets of COLS_PER_SET
  const chunks: NarcoticCountEntry[][] = []
  for (let i = 0; i < data.entries.length; i += COLS_PER_SET) {
    chunks.push(data.entries.slice(i, i + COLS_PER_SET))
  }

  const pickerMonthStart =
    sheetYear && sheetMonth ? new Date(sheetYear, sheetMonth - 1, 1) : new Date(2020, 0, 1)
  const pickerMonthEnd =
    sheetYear && sheetMonth ? new Date(sheetYear, sheetMonth - 1, 1) : new Date(2035, 11, 1)

  return (
    <div className="space-y-3">
      {/* Table actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-muted-foreground">
          Set exact days in each column. Month selection is above.
        </p>
        {!disabled && data.entries.length < 31 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={addColumn}
          >
            <Plus className="size-3" />
            Add Day
          </Button>
        )}
      </div>

      {/* Chunked table sets */}
      {chunks.map((chunk, chunkIndex) => {
        const globalOffset = chunkIndex * COLS_PER_SET

        return (
          <div key={chunkIndex} className="overflow-x-auto max-w-full">
            <table className="border-collapse text-xs">
              <thead>
                {/* Row 1: Drug label header + date headers spanning 3 sub-cols each */}
                <tr>
                  <th
                    className={cn(
                      HDR,
                      "sticky left-0 z-10 bg-muted min-w-[140px] md:min-w-[180px] text-left"
                    )}
                    rowSpan={2}
                  >
                    Drug
                  </th>
                  {chunk.map((entry, li) => {
                    const gi = globalOffset + li
                    const selectedDate = parseIsoDate(entry.date)
                    const dateLabel = selectedDate
                      ? format(selectedDate, "MMM d")
                      : (entry.date || "Date")
                    return (
                      <th
                        key={gi}
                        colSpan={3}
                        className={cn(HDR, "relative min-w-[120px] md:min-w-[140px]")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={disabled}
                                className={cn(
                                  "h-6 px-1.5 gap-1 text-[11px] font-medium",
                                  !entry.date && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="size-3" />
                                <span className="tabular-nums">{dateLabel}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="center">
                              <Calendar
                                mode="single"
                                captionLayout="dropdown"
                                startMonth={pickerMonthStart}
                                endMonth={pickerMonthEnd}
                                defaultMonth={selectedDate ?? pickerMonthStart}
                                selected={selectedDate}
                                onSelect={(date) => {
                                  if (!date) return
                                  updateEntry(gi, { date: toIsoDate(date) })
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          {!disabled && data.entries.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-5 shrink-0 text-muted-foreground/40 hover:text-destructive"
                              onClick={() => removeColumn(gi)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>

                {/* Row 2: Sub-column headers (AM / Rcvd/Used / PM) per date */}
                <tr>
                  {chunk.map((_, li) => {
                    const gi = globalOffset + li
                    return (
                      <Fragment key={gi}>
                        <th className={cn(HDR, "min-w-[40px] text-[10px] md:text-xs")}>AM</th>
                        <th className={cn(HDR, "min-w-[60px] text-[10px] md:text-xs")}>
                          <span className="block leading-tight">Rcvd/</span>
                          <span className="block leading-tight">Used</span>
                        </th>
                        <th className={cn(HDR, "min-w-[40px] text-[10px] md:text-xs")}>PM</th>
                      </Fragment>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {/* Drug rows */}
                {NARCOTIC_COUNT_DRUGS.map((drug) => {
                  const dk = drug.key as "fentanyl" | "midazolam" | "ephedrine"
                  return (
                    <tr key={dk}>
                      <td
                        className={cn(
                          HDR,
                          "sticky left-0 z-10 bg-muted text-left font-medium whitespace-nowrap"
                        )}
                      >
                        <div className="leading-tight">
                          {drug.label}
                          {"detail" in drug && (
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              {(drug as { detail?: string }).detail}
                            </span>
                          )}
                        </div>
                      </td>
                      {chunk.map((entry, li) => {
                        const gi = globalOffset + li
                        return (
                          <Fragment key={gi}>
                            {/* AM */}
                            <td className={cn(CELL, isDraft && entry[dk].am && "bg-yellow-50")}>
                              <Input
                                value={entry[dk].am}
                                onChange={(e) =>
                                  updateDrugField(gi, dk, "am", e.target.value)
                                }
                                disabled={disabled}
                                className={TXT}
                              />
                            </td>
                            {/* Rcvd / Used diagonal */}
                            <DiagonalCell
                              rcvd={entry[dk].rcvd}
                              used={entry[dk].used}
                              onRcvdChange={(v) =>
                                updateDrugField(gi, dk, "rcvd", v)
                              }
                              onUsedChange={(v) =>
                                updateDrugField(gi, dk, "used", v)
                              }
                              disabled={disabled}
                              isDraft={isDraft}
                              hasData={!!(entry[dk].rcvd || entry[dk].used)}
                            />
                            {/* PM */}
                            <td className={cn(CELL, isDraft && entry[dk].pm && "bg-yellow-50")}>
                              <Input
                                value={entry[dk].pm}
                                onChange={(e) =>
                                  updateDrugField(gi, dk, "pm", e.target.value)
                                }
                                disabled={disabled}
                                className={TXT}
                              />
                            </td>
                          </Fragment>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* Initials row: AM (2 stacked) | empty separator | PM (2 stacked) */}
                <tr>
                  <td
                    className={cn(
                      HDR,
                      "sticky left-0 z-10 bg-muted text-left whitespace-nowrap"
                    )}
                  >
                    Initials
                  </td>
                  {chunk.map((entry, li) => {
                    const gi = globalOffset + li
                    const audits = getInitialsAudits(entry)
                    return (
                      <Fragment key={gi}>
                        {/* AM: 2 initials stacked with labels */}
                        <td className={cn(CELL, isDraft && (entry.initials_am || entry.initials_am_2) && "bg-yellow-50")}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground shrink-0">1</span>
                              <InitialsStampCell
                                value={entry.initials_am ?? ""}
                                audit={audits.am_1}
                                locationId={locationId}
                                disabled={disabled}
                                profile={myProfile}
                                slotLabel={`${entry.date || `Column ${gi + 1}`} AM #1`}
                                onStamp={(stamp) =>
                                  updateInitialsSlot(gi, "am_1", stamp.initials, stamp.audit, stamp.signer)
                                }
                                onClear={() => updateInitialsSlot(gi, "am_1", "", null)}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground shrink-0">2</span>
                              <InitialsStampCell
                                value={entry.initials_am_2 ?? ""}
                                audit={audits.am_2}
                                locationId={locationId}
                                disabled={disabled}
                                profile={myProfile}
                                slotLabel={`${entry.date || `Column ${gi + 1}`} AM #2`}
                                onStamp={(stamp) =>
                                  updateInitialsSlot(gi, "am_2", stamp.initials, stamp.audit, stamp.signer)
                                }
                                onClear={() => updateInitialsSlot(gi, "am_2", "", null)}
                              />
                            </div>
                          </div>
                        </td>
                        {/* Separator (Rcvd/Used column - empty) */}
                        <td className={cn(CELL, "bg-muted/10")} />
                        {/* PM: 2 initials stacked with labels */}
                        <td className={cn(CELL, isDraft && (entry.initials_pm || entry.initials_pm_2) && "bg-yellow-50")}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground shrink-0">1</span>
                              <InitialsStampCell
                                value={entry.initials_pm ?? ""}
                                audit={audits.pm_1}
                                locationId={locationId}
                                disabled={disabled}
                                profile={myProfile}
                                slotLabel={`${entry.date || `Column ${gi + 1}`} PM #1`}
                                onStamp={(stamp) =>
                                  updateInitialsSlot(gi, "pm_1", stamp.initials, stamp.audit, stamp.signer)
                                }
                                onClear={() => updateInitialsSlot(gi, "pm_1", "", null)}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground shrink-0">2</span>
                              <InitialsStampCell
                                value={entry.initials_pm_2 ?? ""}
                                audit={audits.pm_2}
                                locationId={locationId}
                                disabled={disabled}
                                profile={myProfile}
                                slotLabel={`${entry.date || `Column ${gi + 1}`} PM #2`}
                                onStamp={(stamp) =>
                                  updateInitialsSlot(gi, "pm_2", stamp.initials, stamp.audit, stamp.signer)
                                }
                                onClear={() => updateInitialsSlot(gi, "pm_2", "", null)}
                              />
                            </div>
                          </div>
                        </td>
                      </Fragment>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
