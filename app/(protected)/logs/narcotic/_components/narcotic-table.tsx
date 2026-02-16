"use client"

import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SignatureCell } from "./signature-cell"
import { cn } from "@/lib/utils"
import type { NarcoticLogData, NarcoticRow } from "@/lib/validations/log-entry"

interface NarcoticTableProps {
  data: NarcoticLogData
  onChange: (data: NarcoticLogData) => void
  locationId: string
  disabled?: boolean
  date: string
  onNavigateDate: (offset: number) => void
  onGoToDate: (date: string) => void
  isPending: boolean
}

function emptyRow(): NarcoticRow {
  return {
    patient: "",
    versed: null,
    versed_waste: null,
    fentanyl: null,
    fentanyl_waste: null,
    drug3: null,
    drug3_waste: null,
    sig1: null,
    sig2: null,
  }
}

function isRowEmpty(row: NarcoticRow): boolean {
  return (
    !row.patient.trim() &&
    row.versed === null &&
    row.versed_waste === null &&
    row.fentanyl === null &&
    row.fentanyl_waste === null &&
    row.drug3 === null &&
    row.drug3_waste === null &&
    !row.sig1 &&
    !row.sig2
  )
}

// ---------------------------------------------------------------------------
// Shared cell style constants
// ---------------------------------------------------------------------------

const B = "border border-foreground/25" // standard border for all cells
const HDR = `${B} bg-muted/30 px-2 py-2 text-xs font-semibold text-center`
const CELL = `${B} px-1.5 py-1.5`
const GREY = "bg-muted/15"
const NUM =
  "h-7 w-full text-center text-xs tabular-nums border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
const TXT =
  "h-7 w-full text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"

const SIG_LABEL = "text-[10px] leading-tight font-semibold"

export function NarcoticTable({ data, onChange, locationId, disabled, date, onNavigateDate, onGoToDate, isPending }: NarcoticTableProps) {
  function updateField<K extends keyof NarcoticLogData>(field: K, value: NarcoticLogData[K]) {
    onChange({ ...data, [field]: value })
  }

  function updateRow(index: number, updates: Partial<NarcoticRow>) {
    const rows = [...data.rows]
    rows[index] = { ...rows[index], ...updates }
    onChange({ ...data, rows })
  }

  function addRow() {
    if (data.rows.length >= 50) return
    onChange({ ...data, rows: [...data.rows, emptyRow()] })
  }

  function removeRow(index: number) {
    if (data.rows.length <= 1) return
    onChange({ ...data, rows: data.rows.filter((_, i) => i !== index) })
  }

  function parseNum(v: string): number | null {
    if (v === "") return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  function numVal(v: number | null): string {
    return v === null ? "" : String(v)
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[880px] border-collapse text-xs">
        <colgroup>
          <col className="w-[22%] min-w-[160px]" />
          <col className="w-[9%] min-w-[68px]" />
          <col className="w-[9%] min-w-[68px]" />
          <col className="w-[9%] min-w-[68px]" />
          <col className="w-[9%] min-w-[68px]" />
          <col className="w-[9%] min-w-[68px]" />
          <col className="w-[9%] min-w-[68px]" />
          <col className="w-[12%] min-w-[100px]" />
          <col className="w-[12%] min-w-[100px]" />
        </colgroup>

        <tbody>
          {/* ================================================================
              ROW 1 — Date:  |  [merged date picker x6]  |  Sig  |  Sig
              ================================================================ */}
          <tr>
            <td className={cn(HDR, "sticky left-0 z-10 bg-muted/30")}>Date:</td>
            <td colSpan={6} className={cn(B, "bg-background px-3 py-2")}>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => onNavigateDate(-1)}
                  disabled={isPending}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm font-medium whitespace-nowrap">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => onNavigateDate(1)}
                  disabled={isPending}
                >
                  <ChevronRight className="size-4" />
                </Button>
                {date !== new Date().toISOString().split("T")[0] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => onGoToDate(new Date().toISOString().split("T")[0])}
                    disabled={isPending}
                  >
                    Today
                  </Button>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 gap-1.5 text-xs font-normal"
                      disabled={isPending}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
                      Pick date
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={new Date(date + "T00:00:00")}
                      onSelect={(d) => {
                        if (d) {
                          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                          onGoToDate(iso)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </td>
            <td className={cn(B, "bg-background px-2 py-2 align-top")}>
              <span className={cn(SIG_LABEL, "mb-1 block text-center text-muted-foreground")}>
                Licensed Staff<br />Signature
              </span>
              <SignatureCell
                value={data.header_sig1}
                onChange={(_p, b) => updateField("header_sig1", b)}
                locationId={locationId}
                disabled={disabled}
              />
            </td>
            <td className={cn(B, "bg-background px-2 py-2 align-top")}>
              <span className={cn(SIG_LABEL, "mb-1 block text-center text-muted-foreground")}>
                Licensed Staff<br />Signature
              </span>
              <SignatureCell
                value={data.header_sig2}
                onChange={(_p, b) => updateField("header_sig2", b)}
                locationId={locationId}
                disabled={disabled}
              />
            </td>
          </tr>

          {/* ================================================================
              ROW 2 — Beginning Count
              ================================================================ */}
          <tr>
            <td className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left")}>Beginning Count:</td>
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.beginning_count.versed)} onChange={(e) => updateField("beginning_count", { ...data.beginning_count, versed: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL, GREY)} />
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.beginning_count.fentanyl)} onChange={(e) => updateField("beginning_count", { ...data.beginning_count, fentanyl: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL, GREY)} />
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.beginning_count.drug3)} onChange={(e) => updateField("beginning_count", { ...data.beginning_count, drug3: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL, GREY)} />
            <td className={cn(CELL, GREY)} />
            <td className={cn(CELL, GREY)} />
          </tr>

          {/* ================================================================
              ROW 3 — Column headers
              ================================================================ */}
          <tr>
            <td className={cn(HDR, "sticky left-0 z-10 bg-muted/30")}>Patient</td>
            <td className={cn(HDR)}>Versed</td>
            <td className={cn(HDR)}>Waste</td>
            <td className={cn(HDR)}>Fentanyl</td>
            <td className={cn(HDR)}>Waste</td>
            <td className={cn(HDR)}>
              <Input
                value={data.drug3_name}
                onChange={(e) => updateField("drug3_name", e.target.value)}
                disabled={disabled}
                className="h-auto border-0 bg-transparent p-0 text-center text-xs font-semibold shadow-none focus-visible:ring-0"
              />
            </td>
            <td className={cn(HDR)}>Waste</td>
            <td className={cn(HDR)}>Licensed Staff Signature</td>
            <td className={cn(HDR)}>Licensed Staff Signature</td>
          </tr>

          {/* ================================================================
              PATIENT ROWS (12 default, expandable)
              ================================================================ */}
          {data.rows.map((row, i) => {
            const empty = isRowEmpty(row)
            const bg = empty ? GREY : ""

            return (
              <tr key={i} className="group">
                <td className={cn(CELL, "sticky left-0 z-10", empty ? "bg-muted/15" : "bg-background")}>
                  <div className="flex items-center gap-0.5">
                    <Input
                      value={row.patient}
                      onChange={(e) => updateRow(i, { patient: e.target.value })}
                      disabled={disabled}
                      className={TXT}
                    />
                    {!disabled && data.rows.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={() => removeRow(i)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </td>
                <td className={cn(CELL, bg)}>
                  <Input type="number" value={numVal(row.versed)} onChange={(e) => updateRow(i, { versed: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
                </td>
                <td className={cn(CELL, bg)}>
                  <Input type="number" value={numVal(row.versed_waste)} onChange={(e) => updateRow(i, { versed_waste: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
                </td>
                <td className={cn(CELL, bg)}>
                  <Input type="number" value={numVal(row.fentanyl)} onChange={(e) => updateRow(i, { fentanyl: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
                </td>
                <td className={cn(CELL, bg)}>
                  <Input type="number" value={numVal(row.fentanyl_waste)} onChange={(e) => updateRow(i, { fentanyl_waste: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
                </td>
                <td className={cn(CELL, bg)}>
                  <Input type="number" value={numVal(row.drug3)} onChange={(e) => updateRow(i, { drug3: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
                </td>
                <td className={cn(CELL, bg)}>
                  <Input type="number" value={numVal(row.drug3_waste)} onChange={(e) => updateRow(i, { drug3_waste: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
                </td>
                <td className={cn(CELL, bg, "px-2")}>
                  <SignatureCell
                    value={row.sig1}
                    onChange={(_p, b) => updateRow(i, { sig1: b })}
                    locationId={locationId}
                    disabled={disabled}
                  />
                </td>
                <td className={cn(CELL, bg, "px-2")}>
                  <SignatureCell
                    value={row.sig2}
                    onChange={(_p, b) => updateRow(i, { sig2: b })}
                    locationId={locationId}
                    disabled={disabled}
                  />
                </td>
              </tr>
            )
          })}

          {/* Add row */}
          {!disabled && data.rows.length < 50 && (
            <tr>
              <td colSpan={9} className={cn(B, "px-2 py-0.5")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={addRow}
                >
                  <Plus className="size-3" />
                  Add Row
                </Button>
              </td>
            </tr>
          )}

          {/* ================================================================
              END COUNT — Label row
              ================================================================ */}
          <tr>
            <td className={cn(HDR, "sticky left-0 z-10 bg-muted/30")} />
            <td className={cn(HDR)}>Versed</td>
            <td className={cn(HDR)}>Total Waste</td>
            <td className={cn(HDR)}>Fentanyl</td>
            <td className={cn(HDR)}>Total Waste</td>
            <td className={cn(HDR)} />
            <td className={cn(HDR)}>Total Waste</td>
            <td className={cn(HDR)}>Licensed Staff Signature</td>
            <td className={cn(HDR)}>Licensed Staff Signature</td>
          </tr>

          {/* ================================================================
              END COUNT — Input row
              ================================================================ */}
          <tr>
            <td className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left")}>End Count:</td>
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.end_count.versed)} onChange={(e) => updateField("end_count", { ...data.end_count, versed: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.end_count.versed_total_waste)} onChange={(e) => updateField("end_count", { ...data.end_count, versed_total_waste: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.end_count.fentanyl)} onChange={(e) => updateField("end_count", { ...data.end_count, fentanyl: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.end_count.fentanyl_total_waste)} onChange={(e) => updateField("end_count", { ...data.end_count, fentanyl_total_waste: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.end_count.drug3)} onChange={(e) => updateField("end_count", { ...data.end_count, drug3: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL)}>
              <Input type="number" value={numVal(data.end_count.drug3_total_waste)} onChange={(e) => updateField("end_count", { ...data.end_count, drug3_total_waste: parseNum(e.target.value) })} disabled={disabled} className={NUM} />
            </td>
            <td className={cn(CELL, "px-2")}>
              <SignatureCell
                value={data.end_sig1}
                onChange={(_p, b) => updateField("end_sig1", b)}
                locationId={locationId}
                disabled={disabled}
              />
            </td>
            <td className={cn(CELL, "px-2")}>
              <SignatureCell
                value={data.end_sig2}
                onChange={(_p, b) => updateField("end_sig2", b)}
                locationId={locationId}
                disabled={disabled}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
