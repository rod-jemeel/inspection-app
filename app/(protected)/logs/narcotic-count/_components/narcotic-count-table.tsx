"use client"

import { Fragment, useState } from "react"
import { format, parse } from "date-fns"
import { Plus, Trash2, CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { NARCOTIC_COUNT_DRUGS } from "@/lib/validations/log-entry"
import type { DailyNarcoticCountLogData, NarcoticCountEntry } from "@/lib/validations/log-entry"
import type { DateRange } from "react-day-picker"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NarcoticCountTableProps {
  data: DailyNarcoticCountLogData
  onChange: (data: DailyNarcoticCountLogData) => void
  disabled?: boolean
  isDraft?: boolean
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
// Empty diagonal cell (used in initials rows for the Rcvd/Used column)
// ---------------------------------------------------------------------------

function EmptyDiagonalCell() {
  return (
    <td className={cn(CELL, "relative p-0")}>
      <div className="relative flex h-8 md:h-9 w-full items-center justify-center overflow-hidden">
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
      </div>
    </td>
  )
}

// ---------------------------------------------------------------------------
// Initials select dropdown
// ---------------------------------------------------------------------------

function InitialsSelect({
  value,
  onChange,
  options,
  disabled,
  isDraft,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  disabled?: boolean
  isDraft?: boolean
}) {
  if (options.length === 0) {
    // Fallback to text input when no signatures have initials yet
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          TXT,
          "text-center",
          isDraft && value && "bg-yellow-50"
        )}
        placeholder=""
      />
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        TXT,
        "appearance-none cursor-pointer bg-[length:12px] bg-[right_2px_center] bg-no-repeat pr-4",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
        isDraft && value && "bg-yellow-50"
      )}
    >
      <option value=""></option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Date range picker (From date / To date)
// ---------------------------------------------------------------------------

function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  disabled,
}: {
  fromDate: string
  toDate: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  // Parse stored strings (YYYY-MM-DD) to Date objects
  const from = fromDate ? parse(fromDate, "yyyy-MM-dd", new Date()) : undefined
  const to = toDate ? parse(toDate, "yyyy-MM-dd", new Date()) : undefined
  const selected: DateRange = { from, to }

  function handleSelect(range: DateRange | undefined) {
    if (range?.from) {
      onFromChange(format(range.from, "yyyy-MM-dd"))
    } else {
      onFromChange("")
    }
    if (range?.to) {
      onToChange(format(range.to, "yyyy-MM-dd"))
    } else {
      onToChange("")
    }
  }

  // Display text
  const label =
    from && to
      ? `${format(from, "MMM d, yyyy")} - ${format(to, "MMM d, yyyy")}`
      : from
        ? `${format(from, "MMM d, yyyy")} - ...`
        : "Select date range"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 justify-start text-xs font-normal gap-1.5",
            !from && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <CalendarIcon className="size-3" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={2}
          defaultMonth={from}
        />
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NarcoticCountTable({ data, onChange, disabled, isDraft }: NarcoticCountTableProps) {
  // Build initials options from signatures
  const initialsOptions = data.signatures
    .map((s) => s.initials)
    .filter((v): v is string => !!v && v.trim() !== "")
    .filter((v, i, arr) => arr.indexOf(v) === i) // unique

  function updateEntry(index: number, updates: Partial<NarcoticCountEntry>) {
    const entries = [...data.entries]
    entries[index] = { ...entries[index], ...updates }
    onChange({ ...data, entries })
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

  const drugKeys = NARCOTIC_COUNT_DRUGS.map((d) => d.key) as Array<
    "fentanyl" | "midazolam" | "ephedrine"
  >

  // Chunk entries into sets of COLS_PER_SET
  const chunks: NarcoticCountEntry[][] = []
  for (let i = 0; i < data.entries.length; i += COLS_PER_SET) {
    chunks.push(data.entries.slice(i, i + COLS_PER_SET))
  }

  return (
    <div className="space-y-3">
      {/* Header fields: Date range picker + Add Date */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <DateRangePicker
          fromDate={data.from_date}
          toDate={data.to_date}
          onFromChange={(v) => onChange({ ...data, from_date: v })}
          onToChange={(v) => onChange({ ...data, to_date: v })}
          disabled={disabled}
        />
        {!disabled && data.entries.length < 31 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={addColumn}
          >
            <Plus className="size-3" />
            Add Date
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
                    return (
                      <th
                        key={gi}
                        colSpan={3}
                        className={cn(HDR, "relative min-w-[120px] md:min-w-[140px]")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            value={entry.date}
                            onChange={(e) => updateEntry(gi, { date: e.target.value })}
                            disabled={disabled}
                            className="h-6 w-24 text-center text-[11px] border-0 bg-transparent shadow-none focus-visible:ring-1"
                            placeholder="Date"
                          />
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
                    return (
                      <Fragment key={gi}>
                        {/* AM: 2 initials stacked with labels */}
                        <td className={cn(CELL, isDraft && (entry.initials_am || entry.initials_am_2) && "bg-yellow-50")}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground shrink-0">1</span>
                              <InitialsSelect
                                value={entry.initials_am ?? ""}
                                onChange={(v) => updateEntry(gi, { initials_am: v })}
                                options={initialsOptions}
                                disabled={disabled}
                                isDraft={isDraft}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground shrink-0">2</span>
                              <InitialsSelect
                                value={entry.initials_am_2 ?? ""}
                                onChange={(v) => updateEntry(gi, { initials_am_2: v })}
                                options={initialsOptions}
                                disabled={disabled}
                                isDraft={isDraft}
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
                              <InitialsSelect
                                value={entry.initials_pm ?? ""}
                                onChange={(v) => updateEntry(gi, { initials_pm: v })}
                                options={initialsOptions}
                                disabled={disabled}
                                isDraft={isDraft}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground shrink-0">2</span>
                              <InitialsSelect
                                value={entry.initials_pm_2 ?? ""}
                                onChange={(v) => updateEntry(gi, { initials_pm_2: v })}
                                options={initialsOptions}
                                disabled={disabled}
                                isDraft={isDraft}
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
