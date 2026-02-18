"use client"

import { CalendarIcon, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SignatureCell } from "@/app/(protected)/logs/narcotic/_components/signature-cell"
import { useMySignature } from "@/hooks/use-my-signature"
import { cn } from "@/lib/utils"
import type { CardiacArrestRecordData, CardiacArrestRow } from "@/lib/validations/log-entry"

interface CardiacArrestTableProps {
  data: CardiacArrestRecordData
  onChange: (data: CardiacArrestRecordData) => void
  locationId: string
  disabled?: boolean
  isDraft?: boolean
}

function emptyRow(): CardiacArrestRow {
  return {
    time: "", cardiac_rhythm: "", pulse: "", respirations: "",
    blood_pressure: "", epinephrine: "", atropine: "", lidocaine_drug: "",
    other_drug: "", joules: "", rhythm_pre: "", rhythm_post: "",
    lidocaine_iv: "", dopamine: "", dobutamine: "", other_iv: "", comments: "",
  }
}

// ---------------------------------------------------------------------------
// Shared cell style constants (matches narcotic-table pattern)
// ---------------------------------------------------------------------------

const B = "border border-foreground/25"
const HDR = `${B} bg-muted/30 px-2 py-2 text-xs font-semibold text-center`
const CELL = `${B} px-1 py-1`
const TXT =
  "h-8 md:h-9 w-full text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
const TXT_SM =
  "h-8 md:h-9 w-full text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
const LBL = `${B} bg-muted/30 px-2 py-1.5 text-xs font-semibold whitespace-nowrap`

export function CardiacArrestTable({ data, onChange, locationId, disabled, isDraft }: CardiacArrestTableProps) {
  const { profile: myProfile } = useMySignature()

  // ---------------------------------------------------------------------------
  // Field updaters
  // ---------------------------------------------------------------------------

  function updateField<K extends keyof CardiacArrestRecordData>(field: K, value: CardiacArrestRecordData[K]) {
    onChange({ ...data, [field]: value })
  }

  function updateInitialSigns(updates: Partial<CardiacArrestRecordData["initial_signs"]>) {
    onChange({ ...data, initial_signs: { ...data.initial_signs, ...updates } })
  }

  function updateVentilation(updates: Partial<CardiacArrestRecordData["ventilation"]>) {
    onChange({ ...data, ventilation: { ...data.ventilation, ...updates } })
  }

  function updateRow(index: number, updates: Partial<CardiacArrestRow>) {
    const rows = [...data.rows]
    rows[index] = { ...rows[index], ...updates }
    onChange({ ...data, rows })
  }

  function updateSignature(
    index: number,
    field: "name" | "signature" | "initials",
    value: string | null,
  ) {
    const sigs = [...data.signatures]
    sigs[index] = { ...sigs[index], [field]: value ?? "" }
    onChange({ ...data, signatures: sigs })
  }

  function addRow() {
    if (data.rows.length >= 50) return
    onChange({ ...data, rows: [...data.rows, emptyRow()] })
  }

  function removeRow(index: number) {
    if (data.rows.length <= 1) return
    onChange({ ...data, rows: data.rows.filter((_, i) => i !== index) })
  }

  // ---------------------------------------------------------------------------
  // Section 1: Header Fields
  // ---------------------------------------------------------------------------

  function renderHeader() {
    return (
      <table className="w-full border-collapse text-xs">
        <tbody>
          {/* Row 1: Admission Diagnosis */}
          <tr>
            <td className={cn(LBL)} colSpan={2}>Admission Diagnosis:</td>
            <td className={cn(CELL)} colSpan={10}>
              <Input
                value={data.admission_diagnosis}
                onChange={(e) => updateField("admission_diagnosis", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
          </tr>

          {/* Row 2: History of Events */}
          <tr>
            <td className={cn(LBL)} colSpan={2}>History of Events Prior to Arrest:</td>
            <td className={cn(CELL)} colSpan={10}>
              <textarea
                value={data.history_prior}
                onChange={(e) => updateField("history_prior", e.target.value)}
                disabled={disabled}
                rows={2}
                className="w-full resize-none bg-transparent px-1 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </td>
          </tr>

          {/* Row 3: Last Observation Time + Initial Signs */}
          <tr>
            <td className={cn(LBL)} colSpan={2}>Last Observation Time:</td>
            <td className={cn(CELL)} colSpan={1}>
              <Input
                type="time"
                value={data.last_observation_time}
                onChange={(e) => updateField("last_observation_time", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
            <td className={cn(LBL)} colSpan={2}>Initial Signs of Arrest:</td>
            <td className={cn(CELL)} colSpan={7}>
              <div className="flex flex-wrap items-center gap-3 px-1">
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={data.initial_signs.cyanosis}
                    onCheckedChange={(v) => updateInitialSigns({ cyanosis: v === true })}
                    disabled={disabled}
                  />
                  Cyanosis
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={data.initial_signs.apnea}
                    onCheckedChange={(v) => updateInitialSigns({ apnea: v === true })}
                    disabled={disabled}
                  />
                  Apnea
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={data.initial_signs.absence_of_pulse}
                    onCheckedChange={(v) => updateInitialSigns({ absence_of_pulse: v === true })}
                    disabled={disabled}
                  />
                  Absence of Pulse
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">Other:</span>
                  <Input
                    value={data.initial_signs.other}
                    onChange={(e) => updateInitialSigns({ other: e.target.value })}
                    disabled={disabled}
                    className="h-7 w-24 text-xs md:w-36"
                  />
                </div>
              </div>
            </td>
          </tr>

          {/* Row 4: Initial Heart Rhythm / Site / Date / Time / Page */}
          <tr>
            <td className={cn(LBL)} colSpan={2}>Initial Heart Rhythm:</td>
            <td className={cn(CELL)} colSpan={1}>
              <Input
                value={data.initial_heart_rhythm}
                onChange={(e) => updateField("initial_heart_rhythm", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
            <td className={cn(LBL)}>Site of Arrest:</td>
            <td className={cn(CELL)} colSpan={2}>
              <Input
                value={data.site_of_arrest}
                onChange={(e) => updateField("site_of_arrest", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
            <td className={cn(LBL)}>Date:</td>
            <td className={cn(CELL)}>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                      "flex h-8 md:h-9 w-full items-center justify-center gap-1 text-xs",
                      !data.arrest_date && "text-muted-foreground",
                    )}
                  >
                    {data.arrest_date ? data.arrest_date : <CalendarIcon className="size-3.5 text-muted-foreground/40" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data.arrest_date ? new Date(data.arrest_date + "T00:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) {
                        const y = d.getFullYear()
                        const m = String(d.getMonth() + 1).padStart(2, "0")
                        const day = String(d.getDate()).padStart(2, "0")
                        updateField("arrest_date", `${y}-${m}-${day}`)
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </td>
            <td className={cn(LBL)}>Time:</td>
            <td className={cn(CELL)}>
              <Input
                type="time"
                value={data.arrest_time}
                onChange={(e) => updateField("arrest_time", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
            <td className={cn(LBL)}>Page</td>
            <td className={cn(CELL)}>
              <div className="flex items-center gap-1">
                <Input
                  value={data.page_number}
                  onChange={(e) => updateField("page_number", e.target.value)}
                  disabled={disabled}
                  className="h-7 w-10 text-center text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="#"
                />
                <span className="text-xs text-muted-foreground">of</span>
                <Input
                  value={data.page_total}
                  onChange={(e) => updateField("page_total", e.target.value)}
                  disabled={disabled}
                  className="h-7 w-10 text-center text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="#"
                />
              </div>
            </td>
          </tr>

          {/* Row 5: CPR Begun + Ventilation */}
          <tr>
            <td className={cn(LBL)} colSpan={2}>Time CPR Begun:</td>
            <td className={cn(CELL)} colSpan={1}>
              <Input
                type="time"
                value={data.time_cpr_begun}
                onChange={(e) => updateField("time_cpr_begun", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
            <td className={cn(LBL)}>Ventilation:</td>
            <td className={cn(CELL)} colSpan={8}>
              <div className="flex flex-wrap items-center gap-3 px-1">
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={data.ventilation.mouth_mask}
                    onCheckedChange={(v) => updateVentilation({ mouth_mask: v === true })}
                    disabled={disabled}
                  />
                  Mouth/Mask
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={data.ventilation.bag_mask}
                    onCheckedChange={(v) => updateVentilation({ bag_mask: v === true })}
                    disabled={disabled}
                  />
                  Bag/Mask
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={data.ventilation.bag_tube}
                    onCheckedChange={(v) => updateVentilation({ bag_tube: v === true })}
                    disabled={disabled}
                  />
                  Bag/Tube
                </label>
              </div>
            </td>
          </tr>

          {/* Row 6: Intubation */}
          <tr>
            <td className={cn(LBL)} colSpan={2}>Intubated By:</td>
            <td className={cn(CELL)} colSpan={4}>
              <Input
                value={data.intubated_by}
                onChange={(e) => updateField("intubated_by", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
            <td className={cn(LBL)}>ETT Size:</td>
            <td className={cn(CELL)} colSpan={2}>
              <Input
                value={data.ett_size}
                onChange={(e) => updateField("ett_size", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
            <td className={cn(LBL)}>Time:</td>
            <td className={cn(CELL)} colSpan={2}>
              <Input
                type="time"
                value={data.intubation_time}
                onChange={(e) => updateField("intubation_time", e.target.value)}
                disabled={disabled}
                className={TXT}
              />
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  // ---------------------------------------------------------------------------
  // Section 2: Main Table
  // ---------------------------------------------------------------------------

  function renderTable() {
    return (
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[1200px] border-collapse text-xs">
          <thead>
            {/* Row 1: Group headers */}
            <tr>
              <th rowSpan={3} className={cn(HDR, "w-[60px]")}>Time</th>
              <th colSpan={4} className={cn(HDR)}>Vital Signs</th>
              <th colSpan={4} className={cn(HDR)}>Drugs (amount &amp; route)</th>
              <th colSpan={3} className={cn(HDR)}>Defibrillation</th>
              <th colSpan={4} className={cn(HDR)}>IV Solutions (dose)</th>
              <th rowSpan={3} className={cn(HDR, "min-w-[80px] md:min-w-[100px]")}>
                <div>Comments</div>
                <div className="font-normal text-[10px] text-muted-foreground leading-tight mt-0.5">(lab results [ABG&apos;s, K+]; procedures performed pacemaker, cardioversion pericardiocentesis [ABP, etc.])</div>
              </th>
            </tr>
            {/* Row 2: Sub-headers */}
            <tr>
              {/* Vital Signs */}
              <th rowSpan={2} className={cn(HDR, "min-w-[60px] md:min-w-[70px]")}>Cardiac Rhythm</th>
              <th rowSpan={2} className={cn(HDR, "min-w-[50px]")}>Pulse</th>
              <th rowSpan={2} className={cn(HDR, "min-w-[50px]")}>
                <div>Resp.</div>
                <div className="font-normal text-[10px] text-muted-foreground">A=assisted S=spont</div>
              </th>
              <th rowSpan={2} className={cn(HDR, "min-w-[50px]")}>BP</th>
              {/* Drugs */}
              <th rowSpan={2} className={cn(HDR, "min-w-[50px] md:min-w-[60px]")}>Epinephrine</th>
              <th rowSpan={2} className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Atropine</th>
              <th rowSpan={2} className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Lidocaine</th>
              <th rowSpan={2} className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Other</th>
              {/* Defibrillation */}
              <th rowSpan={2} className={cn(HDR, "min-w-[50px]")}>Joules</th>
              <th colSpan={2} className={cn(HDR)}>Rhythm</th>
              {/* IV Solutions */}
              <th rowSpan={2} className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
                <div>Lidocaine</div>
                <div className="font-normal text-[10px] text-muted-foreground">2gms/500cc</div>
              </th>
              <th rowSpan={2} className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
                <div>Dopamine</div>
                <div className="font-normal text-[10px] text-muted-foreground">400mg/500cc</div>
              </th>
              <th rowSpan={2} className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
                <div>Dobut.</div>
                <div className="font-normal text-[10px] text-muted-foreground">250mg/250cc</div>
              </th>
              <th rowSpan={2} className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Other</th>
            </tr>
            {/* Row 3: Rhythm sub-headers (Pre / Post) */}
            <tr>
              <th className={cn(HDR, "min-w-[50px]")}>Pre</th>
              <th className={cn(HDR, "min-w-[50px]")}>Post</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="group">
                <td className={cn(CELL, isDraft && row.time && "bg-yellow-50")}>
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="time"
                      value={row.time}
                      onChange={(e) => updateRow(i, { time: e.target.value })}
                      disabled={disabled}
                      className={TXT_SM}
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
                {/* Vital Signs */}
                <td className={cn(CELL, isDraft && row.cardiac_rhythm && "bg-yellow-50")}>
                  <Input value={row.cardiac_rhythm} onChange={(e) => updateRow(i, { cardiac_rhythm: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.pulse && "bg-yellow-50")}>
                  <Input value={row.pulse} onChange={(e) => updateRow(i, { pulse: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.respirations && "bg-yellow-50")}>
                  <Input value={row.respirations} onChange={(e) => updateRow(i, { respirations: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.blood_pressure && "bg-yellow-50")}>
                  <Input value={row.blood_pressure} onChange={(e) => updateRow(i, { blood_pressure: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                {/* Drugs */}
                <td className={cn(CELL, isDraft && row.epinephrine && "bg-yellow-50")}>
                  <Input value={row.epinephrine} onChange={(e) => updateRow(i, { epinephrine: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.atropine && "bg-yellow-50")}>
                  <Input value={row.atropine} onChange={(e) => updateRow(i, { atropine: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.lidocaine_drug && "bg-yellow-50")}>
                  <Input value={row.lidocaine_drug} onChange={(e) => updateRow(i, { lidocaine_drug: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.other_drug && "bg-yellow-50")}>
                  <Input value={row.other_drug} onChange={(e) => updateRow(i, { other_drug: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                {/* Defibrillation */}
                <td className={cn(CELL, isDraft && row.joules && "bg-yellow-50")}>
                  <Input value={row.joules} onChange={(e) => updateRow(i, { joules: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.rhythm_pre && "bg-yellow-50")}>
                  <Input value={row.rhythm_pre} onChange={(e) => updateRow(i, { rhythm_pre: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.rhythm_post && "bg-yellow-50")}>
                  <Input value={row.rhythm_post} onChange={(e) => updateRow(i, { rhythm_post: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                {/* IV Solutions */}
                <td className={cn(CELL, isDraft && row.lidocaine_iv && "bg-yellow-50")}>
                  <Input value={row.lidocaine_iv} onChange={(e) => updateRow(i, { lidocaine_iv: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.dopamine && "bg-yellow-50")}>
                  <Input value={row.dopamine} onChange={(e) => updateRow(i, { dopamine: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.dobutamine && "bg-yellow-50")}>
                  <Input value={row.dobutamine} onChange={(e) => updateRow(i, { dobutamine: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                <td className={cn(CELL, isDraft && row.other_iv && "bg-yellow-50")}>
                  <Input value={row.other_iv} onChange={(e) => updateRow(i, { other_iv: e.target.value })} disabled={disabled} className={TXT_SM} />
                </td>
                {/* Comments */}
                <td className={cn(CELL, isDraft && row.comments && "bg-yellow-50")}>
                  <Input value={row.comments} onChange={(e) => updateRow(i, { comments: e.target.value })} disabled={disabled} className={TXT} />
                </td>
              </tr>
            ))}

            {/* Add row */}
            {!disabled && data.rows.length < 50 && (
              <tr>
                <td colSpan={17} className={cn(B, "px-2 py-0.5")}>
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
          </tbody>
        </table>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Section 3: Footer
  // ---------------------------------------------------------------------------

  function renderFooter() {
    return (
      <div>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {/* Row 1: Code Terminated By / Date / Patient Outcome / Time */}
            <tr>
              <td className={cn(LBL)} colSpan={1}>Code Terminated By:</td>
              <td className={cn(CELL)} colSpan={2}>
                <Input value={data.code_terminated_by} onChange={(e) => updateField("code_terminated_by", e.target.value)} disabled={disabled} className={TXT} />
              </td>
              <td className={cn(LBL)} colSpan={1}>Date:</td>
              <td className={cn(CELL)} colSpan={1}>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={disabled}
                      className={cn(
                        "flex h-8 md:h-9 w-full items-center justify-center gap-1 text-xs",
                        !data.termination_date && "text-muted-foreground",
                      )}
                    >
                      {data.termination_date ? data.termination_date : <CalendarIcon className="size-3.5 text-muted-foreground/40" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={data.termination_date ? new Date(data.termination_date + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          const y = d.getFullYear()
                          const m = String(d.getMonth() + 1).padStart(2, "0")
                          const day = String(d.getDate()).padStart(2, "0")
                          updateField("termination_date", `${y}-${m}-${day}`)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </td>
              <td className={cn(LBL)} colSpan={1}>Patient:</td>
              <td className={cn(CELL)} colSpan={3}>
                <div className="flex items-center gap-3 px-1">
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={data.patient_outcome === "survived"}
                      onCheckedChange={(v) => updateField("patient_outcome", v === true ? "survived" : "")}
                      disabled={disabled}
                    />
                    Survived
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={data.patient_outcome === "expired"}
                      onCheckedChange={(v) => updateField("patient_outcome", v === true ? "expired" : "")}
                      disabled={disabled}
                    />
                    Expired
                  </label>
                </div>
              </td>
              <td className={cn(LBL)} colSpan={1}>Time:</td>
              <td className={cn(CELL)} colSpan={2}>
                <Input type="time" value={data.termination_time} onChange={(e) => updateField("termination_time", e.target.value)} disabled={disabled} className={TXT} />
              </td>
            </tr>

            {/* Row 2: Transferred To / Signatures header */}
            <tr>
              <td className={cn(LBL)} colSpan={1}>Transferred To:</td>
              <td className={cn(CELL)} colSpan={5}>
                <Input value={data.transferred_to} onChange={(e) => updateField("transferred_to", e.target.value)} disabled={disabled} className={TXT} />
              </td>
              <td className={cn(LBL, "text-center")} colSpan={6}>Signatures</td>
            </tr>

            {/* Row 3: Neuro Status / Team Leader & Recording RN */}
            <tr>
              <td className={cn(LBL)} colSpan={1}>Neuro Status on Transfer:</td>
              <td className={cn(CELL)} colSpan={5}>
                <Input value={data.neuro_status} onChange={(e) => updateField("neuro_status", e.target.value)} disabled={disabled} className={TXT} />
              </td>
              <td className={cn(LBL)} colSpan={1}>Team Leader:</td>
              <td className={cn(CELL)} colSpan={2}>
                <SignatureCell
                  value={data.signatures[0]?.signature ?? null}
                  onChange={(_sp, b64) => updateSignature(0, "signature", b64)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                  signerName={data.signatures[0]?.name ?? ""}
                  onNameChange={(name) => updateSignature(0, "name", name)}
                />
              </td>
              <td className={cn(LBL)} colSpan={1}>Recording RN:</td>
              <td className={cn(CELL)} colSpan={2}>
                <SignatureCell
                  value={data.signatures[1]?.signature ?? null}
                  onChange={(_sp, b64) => updateSignature(1, "signature", b64)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                  signerName={data.signatures[1]?.name ?? ""}
                  onNameChange={(name) => updateSignature(1, "name", name)}
                />
              </td>
            </tr>

            {/* Row 4: Time Family Notified / Time MD Notified / Respiratory Care & Other */}
            <tr>
              <td className={cn(LBL)} colSpan={1}>Time Family Notified:</td>
              <td className={cn(CELL)} colSpan={2}>
                <Input type="time" value={data.time_family_notified} onChange={(e) => updateField("time_family_notified", e.target.value)} disabled={disabled} className={TXT} />
              </td>
              <td className={cn(LBL)} colSpan={1}>Time Attending MD / Service Notified:</td>
              <td className={cn(CELL)} colSpan={2}>
                <Input type="time" value={data.time_md_notified} onChange={(e) => updateField("time_md_notified", e.target.value)} disabled={disabled} className={TXT} />
              </td>
              <td className={cn(LBL)} colSpan={1}>Resp. Care:</td>
              <td className={cn(CELL)} colSpan={2}>
                <SignatureCell
                  value={data.signatures[2]?.signature ?? null}
                  onChange={(_sp, b64) => updateSignature(2, "signature", b64)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                  signerName={data.signatures[2]?.name ?? ""}
                  onNameChange={(name) => updateSignature(2, "name", name)}
                />
              </td>
              <td className={cn(LBL)} colSpan={1}>Other:</td>
              <td className={cn(CELL)} colSpan={2}>
                <SignatureCell
                  value={data.signatures[4]?.signature ?? null}
                  onChange={(_sp, b64) => updateSignature(4, "signature", b64)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                  signerName={data.signatures[4]?.name ?? ""}
                  onNameChange={(name) => updateSignature(4, "name", name)}
                />
              </td>
            </tr>

            {/* Row 5: Medication RN & Other */}
            <tr>
              <td className={cn(CELL)} colSpan={6} />
              <td className={cn(LBL)} colSpan={1}>Medication RN:</td>
              <td className={cn(CELL)} colSpan={2}>
                <SignatureCell
                  value={data.signatures[3]?.signature ?? null}
                  onChange={(_sp, b64) => updateSignature(3, "signature", b64)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                  signerName={data.signatures[3]?.name ?? ""}
                  onNameChange={(name) => updateSignature(3, "name", name)}
                />
              </td>
              <td className={cn(LBL)} colSpan={1}>Other:</td>
              <td className={cn(CELL)} colSpan={2}>
                <SignatureCell
                  value={data.signatures[5]?.signature ?? null}
                  onChange={(_sp, b64) => updateSignature(5, "signature", b64)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                  signerName={data.signatures[5]?.name ?? ""}
                  onNameChange={(name) => updateSignature(5, "name", name)}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-center">
          Please save rhythm strips in chart
        </p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-0">
      {renderHeader()}
      {renderTable()}
      {renderFooter()}
    </div>
  )
}
