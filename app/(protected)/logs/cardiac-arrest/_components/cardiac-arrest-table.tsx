"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { CardiacArrestRecordData, CardiacArrestRow } from "@/lib/validations/log-entry"

interface CardiacArrestTableProps {
  data: CardiacArrestRecordData
  onChange: (data: CardiacArrestRecordData) => void
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

export function CardiacArrestTable({ data, onChange, disabled, isDraft }: CardiacArrestTableProps) {
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
      <div className="space-y-3">
        {/* Admission diagnosis */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-xs font-semibold">Admission Diagnosis</label>
            <Input
              value={data.admission_diagnosis}
              onChange={(e) => updateField("admission_diagnosis", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
        </div>

        {/* History */}
        <div>
          <label className="text-xs font-semibold">History of Events Prior to Arrest</label>
          <textarea
            value={data.history_prior}
            onChange={(e) => updateField("history_prior", e.target.value)}
            disabled={disabled}
            rows={2}
            className="mt-1 w-full rounded border border-input bg-transparent px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Last observation time + Initial signs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold">Last Observation Time</label>
            <Input
              value={data.last_observation_time}
              onChange={(e) => updateField("last_observation_time", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Initial Heart Rhythm</label>
            <Input
              value={data.initial_heart_rhythm}
              onChange={(e) => updateField("initial_heart_rhythm", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
        </div>

        {/* Initial signs of arrest */}
        <div>
          <label className="text-xs font-semibold">Initial Signs of Arrest</label>
          <div className="mt-1.5 flex flex-wrap items-center gap-4">
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
                className="h-7 w-28 text-xs md:w-40"
              />
            </div>
          </div>
        </div>

        {/* Site / Date / Time / Page */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs font-semibold">Site of Arrest</label>
            <Input
              value={data.site_of_arrest}
              onChange={(e) => updateField("site_of_arrest", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Date</label>
            <Input
              value={data.arrest_date}
              onChange={(e) => updateField("arrest_date", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Time</label>
            <Input
              value={data.arrest_time}
              onChange={(e) => updateField("arrest_time", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Page</label>
            <div className="mt-1 flex items-center gap-1">
              <Input
                value={data.page_number}
                onChange={(e) => updateField("page_number", e.target.value)}
                disabled={disabled}
                className="h-7 w-12 text-center text-xs"
                placeholder="#"
              />
              <span className="text-xs text-muted-foreground">of</span>
              <Input
                value={data.page_total}
                onChange={(e) => updateField("page_total", e.target.value)}
                disabled={disabled}
                className="h-7 w-12 text-center text-xs"
                placeholder="#"
              />
            </div>
          </div>
        </div>

        {/* CPR begun + Ventilation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold">Time CPR Begun</label>
            <Input
              value={data.time_cpr_begun}
              onChange={(e) => updateField("time_cpr_begun", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Ventilation</label>
            <div className="mt-1.5 flex flex-wrap items-center gap-4">
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
          </div>
        </div>

        {/* Intubation */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold">Intubated By</label>
            <Input
              value={data.intubated_by}
              onChange={(e) => updateField("intubated_by", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">ETT Size</label>
            <Input
              value={data.ett_size}
              onChange={(e) => updateField("ett_size", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Time</label>
            <Input
              value={data.intubation_time}
              onChange={(e) => updateField("intubation_time", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
        </div>
      </div>
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
              <th rowSpan={2} className={cn(HDR, "w-[60px]")}>Time</th>
              <th colSpan={4} className={cn(HDR)}>Vital Signs</th>
              <th colSpan={4} className={cn(HDR)}>Drugs (amount &amp; route)</th>
              <th colSpan={3} className={cn(HDR)}>Defibrillation</th>
              <th colSpan={4} className={cn(HDR)}>IV Solutions (dose)</th>
              <th rowSpan={2} className={cn(HDR, "min-w-[80px] md:min-w-[100px]")}>Comments</th>
            </tr>
            {/* Row 2: Sub-headers */}
            <tr>
              {/* Vital Signs */}
              <th className={cn(HDR, "min-w-[60px] md:min-w-[70px]")}>Cardiac Rhythm</th>
              <th className={cn(HDR, "min-w-[50px]")}>Pulse</th>
              <th className={cn(HDR, "min-w-[50px]")}>
                <div>Resp.</div>
                <div className="font-normal text-[10px] text-muted-foreground">A=assisted S=spont</div>
              </th>
              <th className={cn(HDR, "min-w-[50px]")}>BP</th>
              {/* Drugs */}
              <th className={cn(HDR, "min-w-[50px] md:min-w-[60px]")}>Epinephrine</th>
              <th className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Atropine</th>
              <th className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Lidocaine</th>
              <th className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Other</th>
              {/* Defibrillation */}
              <th className={cn(HDR, "min-w-[50px]")}>Joules</th>
              <th className={cn(HDR, "min-w-[50px]")}>Pre</th>
              <th className={cn(HDR, "min-w-[50px]")}>Post</th>
              {/* IV Solutions */}
              <th className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
                <div>Lidocaine</div>
                <div className="font-normal text-[10px] text-muted-foreground">2gms/500cc</div>
              </th>
              <th className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
                <div>Dopamine</div>
                <div className="font-normal text-[10px] text-muted-foreground">400mg/500cc</div>
              </th>
              <th className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
                <div>Dobut.</div>
                <div className="font-normal text-[10px] text-muted-foreground">250mg/250cc</div>
              </th>
              <th className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Other</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="group">
                <td className={cn(CELL, isDraft && row.time && "bg-yellow-50")}>
                  <div className="flex items-center gap-0.5">
                    <Input
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
      <div className="space-y-3">
        {/* Code terminated by / Date / Outcome / Time */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs font-semibold">Code Terminated By</label>
            <Input
              value={data.code_terminated_by}
              onChange={(e) => updateField("code_terminated_by", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Date</label>
            <Input
              value={data.termination_date}
              onChange={(e) => updateField("termination_date", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Patient Outcome</label>
            <div className="mt-1.5 flex items-center gap-4">
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
          </div>
          <div>
            <label className="text-xs font-semibold">Time</label>
            <Input
              value={data.termination_time}
              onChange={(e) => updateField("termination_time", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
        </div>

        {/* Transferred to */}
        <div>
          <label className="text-xs font-semibold">Transferred To</label>
          <Input
            value={data.transferred_to}
            onChange={(e) => updateField("transferred_to", e.target.value)}
            disabled={disabled}
            className="mt-1 h-7 text-xs"
          />
        </div>

        {/* Neuro status */}
        <div>
          <label className="text-xs font-semibold">Neuro Status on Transfer</label>
          <Input
            value={data.neuro_status}
            onChange={(e) => updateField("neuro_status", e.target.value)}
            disabled={disabled}
            className="mt-1 h-7 text-xs"
          />
        </div>

        {/* Notification times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold">Time Family Notified</label>
            <Input
              value={data.time_family_notified}
              onChange={(e) => updateField("time_family_notified", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Time Attending MD / Service Notified</label>
            <Input
              value={data.time_md_notified}
              onChange={(e) => updateField("time_md_notified", e.target.value)}
              disabled={disabled}
              className="mt-1 h-7 text-xs"
            />
          </div>
        </div>

        {/* Signatures */}
        <div>
          <label className="text-xs font-semibold">Signatures</label>
          <div className="mt-1.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[10px] text-muted-foreground md:text-xs">Team Leader</label>
              <Input
                value={data.team_leader}
                onChange={(e) => updateField("team_leader", e.target.value)}
                disabled={disabled}
                className="mt-0.5 h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground md:text-xs">Recording RN</label>
              <Input
                value={data.recording_rn}
                onChange={(e) => updateField("recording_rn", e.target.value)}
                disabled={disabled}
                className="mt-0.5 h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground md:text-xs">Respiratory Care Practitioner</label>
              <Input
                value={data.respiratory_care}
                onChange={(e) => updateField("respiratory_care", e.target.value)}
                disabled={disabled}
                className="mt-0.5 h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground md:text-xs">Medication RN</label>
              <Input
                value={data.medication_rn}
                onChange={(e) => updateField("medication_rn", e.target.value)}
                disabled={disabled}
                className="mt-0.5 h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground md:text-xs">Other</label>
              <Input
                value={data.other_sig_1}
                onChange={(e) => updateField("other_sig_1", e.target.value)}
                disabled={disabled}
                className="mt-0.5 h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground md:text-xs">Other</label>
              <Input
                value={data.other_sig_2}
                onChange={(e) => updateField("other_sig_2", e.target.value)}
                disabled={disabled}
                className="mt-0.5 h-7 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Note */}
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Please save rhythm strips in chart
        </p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {renderHeader()}
      {renderTable()}
      {renderFooter()}
    </div>
  )
}
