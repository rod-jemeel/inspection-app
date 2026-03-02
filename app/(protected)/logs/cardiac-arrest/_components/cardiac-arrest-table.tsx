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
    time: "",
    cardiac_rhythm: "",
    pulse: "",
    respirations: "",
    blood_pressure: "",
    epinephrine: "",
    atropine: "",
    lidocaine_drug: "",
    other_drug: "",
    joules: "",
    rhythm_pre: "",
    rhythm_post: "",
    lidocaine_iv: "",
    dopamine: "",
    dobutamine: "",
    other_iv: "",
    comments: "",
  }
}

const B = "border border-foreground/25"
const HDR = `${B} bg-muted/30 px-2 py-2 text-xs font-semibold text-center`
const CELL = `${B} px-1 py-1`
const TXT =
  "h-8 md:h-9 w-full text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
const TXT_SM =
  "h-8 md:h-9 w-full text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
const LBL = `${B} bg-muted/30 px-2 py-1.5 text-xs font-semibold whitespace-nowrap`

function DatePickerCell({
  value,
  disabled,
  onSelect,
}: {
  value: string
  disabled?: boolean
  onSelect: (value: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-8 md:h-9 w-full items-center justify-center gap-1 text-xs",
            !value && "text-muted-foreground",
          )}
        >
          {value ? value : <CalendarIcon className="size-3.5 text-muted-foreground/40" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={new Date(2020, 0, 1)}
          endMonth={new Date(2035, 11, 1)}
          selected={value ? new Date(value + "T00:00:00") : undefined}
          onSelect={(date) => {
            if (!date) return
            const y = date.getFullYear()
            const m = String(date.getMonth() + 1).padStart(2, "0")
            const day = String(date.getDate()).padStart(2, "0")
            onSelect(`${y}-${m}-${day}`)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function SignatureRoleCell({
  value,
  signerName,
  signedAt,
  locationId,
  disabled,
  defaultSignerName,
  onSignedMetaChange,
}: {
  value: string | null
  signerName: string
  signedAt: string
  locationId: string
  disabled?: boolean
  defaultSignerName?: string
  onSignedMetaChange: (meta: { signerName: string; signedAt: string; signatureBase64?: string } | null) => void
}) {
  return (
    <SignatureCell
      value={value}
      onChange={() => {}}
      locationId={locationId}
      disabled={disabled}
      defaultSignerName={defaultSignerName}
      signerName={signerName}
      signedAt={signedAt}
      onSignedMetaChange={onSignedMetaChange}
    />
  )
}

function CardiacHeaderSection({
  data,
  disabled,
  onUpdateField,
  onUpdateInitialSigns,
  onUpdateVentilation,
}: {
  data: CardiacArrestRecordData
  disabled?: boolean
  onUpdateField: <K extends keyof CardiacArrestRecordData>(field: K, value: CardiacArrestRecordData[K]) => void
  onUpdateInitialSigns: (updates: Partial<CardiacArrestRecordData["initial_signs"]>) => void
  onUpdateVentilation: (updates: Partial<CardiacArrestRecordData["ventilation"]>) => void
}) {
  return (
    <table className="w-full border-collapse text-xs">
      <tbody>
        <tr>
          <td className={cn(LBL)} colSpan={2}>Admission Diagnosis:</td>
          <td className={cn(CELL)} colSpan={10}>
            <Input value={data.admission_diagnosis} onChange={(e) => onUpdateField("admission_diagnosis", e.target.value)} disabled={disabled} className={TXT} />
          </td>
        </tr>
        <tr>
          <td className={cn(LBL)} colSpan={2}>History of Events Prior to Arrest:</td>
          <td className={cn(CELL)} colSpan={10}>
            <textarea
              value={data.history_prior}
              onChange={(e) => onUpdateField("history_prior", e.target.value)}
              disabled={disabled}
              rows={2}
              className="w-full resize-none bg-transparent px-1 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </td>
        </tr>
        <tr>
          <td className={cn(LBL)} colSpan={2}>Last Observation Time:</td>
          <td className={cn(CELL)} colSpan={1}>
            <Input type="time" value={data.last_observation_time} onChange={(e) => onUpdateField("last_observation_time", e.target.value)} disabled={disabled} className={TXT} />
          </td>
          <td className={cn(LBL)} colSpan={2}>Initial Signs of Arrest:</td>
          <td className={cn(CELL)} colSpan={7}>
            <div className="flex flex-wrap items-center gap-3 px-1">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={data.initial_signs.cyanosis} onCheckedChange={(v) => onUpdateInitialSigns({ cyanosis: v === true })} disabled={disabled} />
                Cyanosis
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={data.initial_signs.apnea} onCheckedChange={(v) => onUpdateInitialSigns({ apnea: v === true })} disabled={disabled} />
                Apnea
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={data.initial_signs.absence_of_pulse} onCheckedChange={(v) => onUpdateInitialSigns({ absence_of_pulse: v === true })} disabled={disabled} />
                Absence of Pulse
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">Other:</span>
                <Input value={data.initial_signs.other} onChange={(e) => onUpdateInitialSigns({ other: e.target.value })} disabled={disabled} className="h-7 w-24 text-xs md:w-36" />
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td className={cn(LBL)} colSpan={2}>Initial Heart Rhythm:</td>
          <td className={cn(CELL)} colSpan={1}>
            <Input value={data.initial_heart_rhythm} onChange={(e) => onUpdateField("initial_heart_rhythm", e.target.value)} disabled={disabled} className={TXT} />
          </td>
          <td className={cn(LBL)}>Site of Arrest:</td>
          <td className={cn(CELL)} colSpan={2}>
            <Input value={data.site_of_arrest} onChange={(e) => onUpdateField("site_of_arrest", e.target.value)} disabled={disabled} className={TXT} />
          </td>
          <td className={cn(LBL)}>Date:</td>
          <td className={cn(CELL)}>
            <DatePickerCell value={data.arrest_date} disabled={disabled} onSelect={(value) => onUpdateField("arrest_date", value)} />
          </td>
          <td className={cn(LBL)}>Time:</td>
          <td className={cn(CELL)}>
            <Input type="time" value={data.arrest_time} onChange={(e) => onUpdateField("arrest_time", e.target.value)} disabled={disabled} className={TXT} />
          </td>
          <td className={cn(LBL)}>Page</td>
          <td className={cn(CELL)}>
            <div className="flex items-center gap-1">
              <Input value={data.page_number} onChange={(e) => onUpdateField("page_number", e.target.value)} disabled={disabled} className="h-7 w-10 border-0 bg-transparent text-center text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="#" />
              <span className="text-xs text-muted-foreground">of</span>
              <Input value={data.page_total} onChange={(e) => onUpdateField("page_total", e.target.value)} disabled={disabled} className="h-7 w-10 border-0 bg-transparent text-center text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="#" />
            </div>
          </td>
        </tr>
        <tr>
          <td className={cn(LBL)} colSpan={2}>Time CPR Begun:</td>
          <td className={cn(CELL)} colSpan={1}>
            <Input type="time" value={data.time_cpr_begun} onChange={(e) => onUpdateField("time_cpr_begun", e.target.value)} disabled={disabled} className={TXT} />
          </td>
          <td className={cn(LBL)}>Ventilation:</td>
          <td className={cn(CELL)} colSpan={8}>
            <div className="flex flex-wrap items-center gap-3 px-1">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={data.ventilation.mouth_mask} onCheckedChange={(v) => onUpdateVentilation({ mouth_mask: v === true })} disabled={disabled} />
                Mouth/Mask
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={data.ventilation.bag_mask} onCheckedChange={(v) => onUpdateVentilation({ bag_mask: v === true })} disabled={disabled} />
                Bag/Mask
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={data.ventilation.bag_tube} onCheckedChange={(v) => onUpdateVentilation({ bag_tube: v === true })} disabled={disabled} />
                Bag/Tube
              </label>
            </div>
          </td>
        </tr>
        <tr>
          <td className={cn(LBL)} colSpan={2}>Intubated By:</td>
          <td className={cn(CELL)} colSpan={4}>
            <Input value={data.intubated_by} onChange={(e) => onUpdateField("intubated_by", e.target.value)} disabled={disabled} className={TXT} />
          </td>
          <td className={cn(LBL)}>ETT Size:</td>
          <td className={cn(CELL)} colSpan={2}>
            <Input value={data.ett_size} onChange={(e) => onUpdateField("ett_size", e.target.value)} disabled={disabled} className={TXT} />
          </td>
          <td className={cn(LBL)}>Time:</td>
          <td className={cn(CELL)} colSpan={2}>
            <Input type="time" value={data.intubation_time} onChange={(e) => onUpdateField("intubation_time", e.target.value)} disabled={disabled} className={TXT} />
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function CardiacMainHeader() {
  return (
    <thead>
      <tr>
        <th rowSpan={3} className={cn(HDR, "w-[60px]")}>Time</th>
        <th colSpan={4} className={cn(HDR)}>Vital Signs</th>
        <th colSpan={4} className={cn(HDR)}>Drugs (amount &amp; route)</th>
        <th colSpan={3} className={cn(HDR)}>Defibrillation</th>
        <th colSpan={4} className={cn(HDR)}>IV Solutions (dose)</th>
        <th rowSpan={3} className={cn(HDR, "min-w-[80px] md:min-w-[100px]")}>
          <div>Comments</div>
          <div className="mt-0.5 text-[10px] font-normal leading-tight text-muted-foreground">
            (lab results [ABG&apos;s, K+]; procedures performed pacemaker, cardioversion pericardiocentesis [ABP, etc.])
          </div>
        </th>
      </tr>
      <tr>
        <th rowSpan={2} className={cn(HDR, "min-w-[60px] md:min-w-[70px]")}>Cardiac Rhythm</th>
        <th rowSpan={2} className={cn(HDR, "min-w-[50px]")}>Pulse</th>
        <th rowSpan={2} className={cn(HDR, "min-w-[50px]")}>
          <div>Resp.</div>
          <div className="text-[10px] font-normal text-muted-foreground">A=assisted S=spont</div>
        </th>
        <th rowSpan={2} className={cn(HDR, "min-w-[50px]")}>BP</th>
        <th rowSpan={2} className={cn(HDR, "min-w-[50px] md:min-w-[60px]")}>Epinephrine</th>
        <th rowSpan={2} className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Atropine</th>
        <th rowSpan={2} className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Lidocaine</th>
        <th rowSpan={2} className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Other</th>
        <th rowSpan={2} className={cn(HDR, "min-w-[50px]")}>Joules</th>
        <th colSpan={2} className={cn(HDR)}>Rhythm</th>
        <th rowSpan={2} className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
          <div>Lidocaine</div>
          <div className="text-[10px] font-normal text-muted-foreground">2gms/500cc</div>
        </th>
        <th rowSpan={2} className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
          <div>Dopamine</div>
          <div className="text-[10px] font-normal text-muted-foreground">400mg/500cc</div>
        </th>
        <th rowSpan={2} className={cn(HDR, "min-w-[55px] md:min-w-[70px]")}>
          <div>Dobut.</div>
          <div className="text-[10px] font-normal text-muted-foreground">250mg/250cc</div>
        </th>
        <th rowSpan={2} className={cn(HDR, "min-w-[45px] md:min-w-[55px]")}>Other</th>
      </tr>
      <tr>
        <th className={cn(HDR, "min-w-[50px]")}>Pre</th>
        <th className={cn(HDR, "min-w-[50px]")}>Post</th>
      </tr>
    </thead>
  )
}

function CardiacMainRow({
  row,
  index,
  disabled,
  isDraft,
  canDelete,
  onUpdateRow,
  onRemoveRow,
}: {
  row: CardiacArrestRow
  index: number
  disabled?: boolean
  isDraft?: boolean
  canDelete: boolean
  onUpdateRow: (index: number, updates: Partial<CardiacArrestRow>) => void
  onRemoveRow: (index: number) => void
}) {
  return (
    <tr className="group">
      <td className={cn(CELL, isDraft && row.time && "bg-yellow-50")}>
        <div className="flex items-center gap-0.5">
          <Input type="time" value={row.time} onChange={(e) => onUpdateRow(index, { time: e.target.value })} disabled={disabled} className={TXT_SM} />
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-5 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              onClick={() => onRemoveRow(index)}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </td>
      <td className={cn(CELL, isDraft && row.cardiac_rhythm && "bg-yellow-50")}><Input value={row.cardiac_rhythm} onChange={(e) => onUpdateRow(index, { cardiac_rhythm: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.pulse && "bg-yellow-50")}><Input value={row.pulse} onChange={(e) => onUpdateRow(index, { pulse: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.respirations && "bg-yellow-50")}><Input value={row.respirations} onChange={(e) => onUpdateRow(index, { respirations: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.blood_pressure && "bg-yellow-50")}><Input value={row.blood_pressure} onChange={(e) => onUpdateRow(index, { blood_pressure: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.epinephrine && "bg-yellow-50")}><Input value={row.epinephrine} onChange={(e) => onUpdateRow(index, { epinephrine: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.atropine && "bg-yellow-50")}><Input value={row.atropine} onChange={(e) => onUpdateRow(index, { atropine: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.lidocaine_drug && "bg-yellow-50")}><Input value={row.lidocaine_drug} onChange={(e) => onUpdateRow(index, { lidocaine_drug: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.other_drug && "bg-yellow-50")}><Input value={row.other_drug} onChange={(e) => onUpdateRow(index, { other_drug: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.joules && "bg-yellow-50")}><Input value={row.joules} onChange={(e) => onUpdateRow(index, { joules: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.rhythm_pre && "bg-yellow-50")}><Input value={row.rhythm_pre} onChange={(e) => onUpdateRow(index, { rhythm_pre: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.rhythm_post && "bg-yellow-50")}><Input value={row.rhythm_post} onChange={(e) => onUpdateRow(index, { rhythm_post: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.lidocaine_iv && "bg-yellow-50")}><Input value={row.lidocaine_iv} onChange={(e) => onUpdateRow(index, { lidocaine_iv: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.dopamine && "bg-yellow-50")}><Input value={row.dopamine} onChange={(e) => onUpdateRow(index, { dopamine: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.dobutamine && "bg-yellow-50")}><Input value={row.dobutamine} onChange={(e) => onUpdateRow(index, { dobutamine: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.other_iv && "bg-yellow-50")}><Input value={row.other_iv} onChange={(e) => onUpdateRow(index, { other_iv: e.target.value })} disabled={disabled} className={TXT_SM} /></td>
      <td className={cn(CELL, isDraft && row.comments && "bg-yellow-50")}><Input value={row.comments} onChange={(e) => onUpdateRow(index, { comments: e.target.value })} disabled={disabled} className={TXT} /></td>
    </tr>
  )
}

function CardiacMainSection({
  data,
  disabled,
  isDraft,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
}: {
  data: CardiacArrestRecordData
  disabled?: boolean
  isDraft?: boolean
  onUpdateRow: (index: number, updates: Partial<CardiacArrestRow>) => void
  onAddRow: () => void
  onRemoveRow: (index: number) => void
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[1200px] border-collapse text-xs">
        <CardiacMainHeader />
        <tbody>
          {data.rows.map((row, index) => (
            <CardiacMainRow
              key={index}
              row={row}
              index={index}
              disabled={disabled}
              isDraft={isDraft}
              canDelete={!disabled && data.rows.length > 1}
              onUpdateRow={onUpdateRow}
              onRemoveRow={onRemoveRow}
            />
          ))}
          {!disabled && data.rows.length < 50 && (
            <tr>
              <td colSpan={17} className={cn(B, "px-2 py-0.5")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={onAddRow}
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

function CardiacFooterSection({
  data,
  locationId,
  disabled,
  defaultSignerName,
  onUpdateField,
  onUpdateSignatureFields,
}: {
  data: CardiacArrestRecordData
  locationId: string
  disabled?: boolean
  defaultSignerName?: string
  onUpdateField: <K extends keyof CardiacArrestRecordData>(field: K, value: CardiacArrestRecordData[K]) => void
  onUpdateSignatureFields: (
    index: number,
    fields: Partial<CardiacArrestRecordData["signatures"][number]>
  ) => void
}) {
  return (
    <div>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className={cn(LBL)} colSpan={1}>Code Terminated By:</td>
            <td className={cn(CELL)} colSpan={2}><Input value={data.code_terminated_by} onChange={(e) => onUpdateField("code_terminated_by", e.target.value)} disabled={disabled} className={TXT} /></td>
            <td className={cn(LBL)} colSpan={1}>Date:</td>
            <td className={cn(CELL)} colSpan={1}><DatePickerCell value={data.termination_date} disabled={disabled} onSelect={(value) => onUpdateField("termination_date", value)} /></td>
            <td className={cn(LBL)} colSpan={1}>Patient:</td>
            <td className={cn(CELL)} colSpan={3}>
              <div className="flex items-center gap-3 px-1">
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={data.patient_outcome === "survived"} onCheckedChange={(v) => onUpdateField("patient_outcome", v === true ? "survived" : "")} disabled={disabled} />
                  Survived
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={data.patient_outcome === "expired"} onCheckedChange={(v) => onUpdateField("patient_outcome", v === true ? "expired" : "")} disabled={disabled} />
                  Expired
                </label>
              </div>
            </td>
            <td className={cn(LBL)} colSpan={1}>Time:</td>
            <td className={cn(CELL)} colSpan={2}><Input type="time" value={data.termination_time} onChange={(e) => onUpdateField("termination_time", e.target.value)} disabled={disabled} className={TXT} /></td>
          </tr>
          <tr>
            <td className={cn(LBL)} colSpan={1}>Transferred To:</td>
            <td className={cn(CELL)} colSpan={5}><Input value={data.transferred_to} onChange={(e) => onUpdateField("transferred_to", e.target.value)} disabled={disabled} className={TXT} /></td>
            <td className={cn(LBL, "text-center")} colSpan={6}>Signatures</td>
          </tr>
          <tr>
            <td className={cn(LBL)} colSpan={1}>Neuro Status on Transfer:</td>
            <td className={cn(CELL)} colSpan={5}><Input value={data.neuro_status} onChange={(e) => onUpdateField("neuro_status", e.target.value)} disabled={disabled} className={TXT} /></td>
            <td className={cn(LBL)} colSpan={1}>Team Leader:</td>
            <td className={cn(CELL)} colSpan={2}>
              <SignatureRoleCell value={data.signatures[0]?.signature ?? null} signerName={data.signatures[0]?.name ?? ""} signedAt={data.signatures[0]?.signed_at ?? ""} locationId={locationId} disabled={disabled} defaultSignerName={defaultSignerName} onSignedMetaChange={(meta) => onUpdateSignatureFields(0, { signature: meta?.signatureBase64 ?? null, name: meta?.signerName ?? "", signed_at: meta?.signedAt ?? "" })} />
            </td>
            <td className={cn(LBL)} colSpan={1}>Recording RN:</td>
            <td className={cn(CELL)} colSpan={2}>
              <SignatureRoleCell value={data.signatures[1]?.signature ?? null} signerName={data.signatures[1]?.name ?? ""} signedAt={data.signatures[1]?.signed_at ?? ""} locationId={locationId} disabled={disabled} defaultSignerName={defaultSignerName} onSignedMetaChange={(meta) => onUpdateSignatureFields(1, { signature: meta?.signatureBase64 ?? null, name: meta?.signerName ?? "", signed_at: meta?.signedAt ?? "" })} />
            </td>
          </tr>
          <tr>
            <td className={cn(LBL)} colSpan={1}>Time Family Notified:</td>
            <td className={cn(CELL)} colSpan={2}><Input type="time" value={data.time_family_notified} onChange={(e) => onUpdateField("time_family_notified", e.target.value)} disabled={disabled} className={TXT} /></td>
            <td className={cn(LBL)} colSpan={1}>Time Attending MD / Service Notified:</td>
            <td className={cn(CELL)} colSpan={2}><Input type="time" value={data.time_md_notified} onChange={(e) => onUpdateField("time_md_notified", e.target.value)} disabled={disabled} className={TXT} /></td>
            <td className={cn(LBL)} colSpan={1}>Resp. Care:</td>
            <td className={cn(CELL)} colSpan={2}>
              <SignatureRoleCell value={data.signatures[2]?.signature ?? null} signerName={data.signatures[2]?.name ?? ""} signedAt={data.signatures[2]?.signed_at ?? ""} locationId={locationId} disabled={disabled} defaultSignerName={defaultSignerName} onSignedMetaChange={(meta) => onUpdateSignatureFields(2, { signature: meta?.signatureBase64 ?? null, name: meta?.signerName ?? "", signed_at: meta?.signedAt ?? "" })} />
            </td>
            <td className={cn(LBL)} colSpan={1}>Other:</td>
            <td className={cn(CELL)} colSpan={2}>
              <SignatureRoleCell value={data.signatures[4]?.signature ?? null} signerName={data.signatures[4]?.name ?? ""} signedAt={data.signatures[4]?.signed_at ?? ""} locationId={locationId} disabled={disabled} defaultSignerName={defaultSignerName} onSignedMetaChange={(meta) => onUpdateSignatureFields(4, { signature: meta?.signatureBase64 ?? null, name: meta?.signerName ?? "", signed_at: meta?.signedAt ?? "" })} />
            </td>
          </tr>
          <tr>
            <td className={cn(CELL)} colSpan={6} />
            <td className={cn(LBL)} colSpan={1}>Medication RN:</td>
            <td className={cn(CELL)} colSpan={2}>
              <SignatureRoleCell value={data.signatures[3]?.signature ?? null} signerName={data.signatures[3]?.name ?? ""} signedAt={data.signatures[3]?.signed_at ?? ""} locationId={locationId} disabled={disabled} defaultSignerName={defaultSignerName} onSignedMetaChange={(meta) => onUpdateSignatureFields(3, { signature: meta?.signatureBase64 ?? null, name: meta?.signerName ?? "", signed_at: meta?.signedAt ?? "" })} />
            </td>
            <td className={cn(LBL)} colSpan={1}>Other:</td>
            <td className={cn(CELL)} colSpan={2}>
              <SignatureRoleCell value={data.signatures[5]?.signature ?? null} signerName={data.signatures[5]?.name ?? ""} signedAt={data.signatures[5]?.signed_at ?? ""} locationId={locationId} disabled={disabled} defaultSignerName={defaultSignerName} onSignedMetaChange={(meta) => onUpdateSignatureFields(5, { signature: meta?.signatureBase64 ?? null, name: meta?.signerName ?? "", signed_at: meta?.signedAt ?? "" })} />
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-center text-xs font-bold uppercase tracking-wide">
        Please save rhythm strips in chart
      </p>
    </div>
  )
}

export function CardiacArrestTable({
  data,
  onChange,
  locationId,
  disabled,
  isDraft,
}: CardiacArrestTableProps) {
  const { profile: myProfile } = useMySignature()

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

  function updateSignatureFields(
    index: number,
    fields: Partial<CardiacArrestRecordData["signatures"][number]>
  ) {
    const signatures = [...data.signatures]
    signatures[index] = { ...signatures[index], ...fields }
    onChange({ ...data, signatures })
  }

  function addRow() {
    if (data.rows.length >= 50) return
    onChange({ ...data, rows: [...data.rows, emptyRow()] })
  }

  function removeRow(index: number) {
    if (data.rows.length <= 1) return
    onChange({ ...data, rows: data.rows.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-0">
      <CardiacHeaderSection
        data={data}
        disabled={disabled}
        onUpdateField={updateField}
        onUpdateInitialSigns={updateInitialSigns}
        onUpdateVentilation={updateVentilation}
      />
      <CardiacMainSection
        data={data}
        disabled={disabled}
        isDraft={isDraft}
        onUpdateRow={updateRow}
        onAddRow={addRow}
        onRemoveRow={removeRow}
      />
      <CardiacFooterSection
        data={data}
        locationId={locationId}
        disabled={disabled}
        defaultSignerName={myProfile?.name}
        onUpdateField={updateField}
        onUpdateSignatureFields={updateSignatureFields}
      />
    </div>
  )
}
