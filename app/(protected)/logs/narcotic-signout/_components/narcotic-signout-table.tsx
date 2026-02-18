"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SignatureCell } from "../../narcotic/_components/signature-cell"
import { useMySignature } from "@/hooks/use-my-signature"
import { cn } from "@/lib/utils"
import { SIGNOUT_DRUGS } from "@/lib/validations/log-entry"
import type { NarcoticSignoutLogData } from "@/lib/validations/log-entry"

interface NarcoticSignoutTableProps {
  data: NarcoticSignoutLogData
  onChange: (data: NarcoticSignoutLogData) => void
  locationId: string
  disabled?: boolean
  date: string
  onNavigateDate: (offset: number) => void
  onGoToDate: (date: string) => void
  isPending: boolean
  isDraft?: boolean
}

// ---------------------------------------------------------------------------
// Shared cell style constants (matches narcotic-table.tsx)
// ---------------------------------------------------------------------------

const B = "border border-foreground/25"
const HDR = `${B} bg-muted/30 px-2 py-2 text-xs font-semibold text-center`
const CELL = `${B} px-1.5 py-1.5`
const TXT =
  "h-8 w-full text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
const NUM =
  "h-8 w-full text-center text-xs tabular-nums border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

const DRUG_COUNT = SIGNOUT_DRUGS.length // 5 (4 preset + 1 custom)

export function NarcoticSignoutTable({
  data,
  onChange,
  locationId,
  disabled,
  date,
  onNavigateDate,
  onGoToDate,
  isPending,
  isDraft,
}: NarcoticSignoutTableProps) {
  const { profile: myProfile } = useMySignature()
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function updateTop<K extends keyof NarcoticSignoutLogData>(
    field: K,
    value: NarcoticSignoutLogData[K]
  ) {
    onChange({ ...data, [field]: value })
  }

  function updateDrugHeader(
    drugKey: string,
    field: "anesthesiologist_sig" | "nurse_sig" | "qty_dispensed",
    value: string | null
  ) {
    const headers = { ...data.drug_headers }
    headers[drugKey] = {
      ...(headers[drugKey] ?? { anesthesiologist_sig: null, nurse_sig: null, qty_dispensed: "" }),
      [field]: value,
    }
    onChange({ ...data, drug_headers: headers })
  }

  function updateCase(
    caseIdx: number,
    updates: Partial<NarcoticSignoutLogData["cases"][number]>
  ) {
    const cases = [...data.cases]
    cases[caseIdx] = { ...cases[caseIdx], ...updates }
    onChange({ ...data, cases })
  }

  function updateCaseAmount(
    caseIdx: number,
    drugKey: string,
    field: "administered" | "wasted",
    value: string
  ) {
    const cases = [...data.cases]
    const amounts = { ...cases[caseIdx].amounts }
    amounts[drugKey] = {
      ...(amounts[drugKey] ?? { administered: "", wasted: "" }),
      [field]: value,
    }
    cases[caseIdx] = { ...cases[caseIdx], amounts }
    onChange({ ...data, cases })
  }

  function updateRecord(
    field: "total_qty_used" | "end_balance",
    drugKey: string,
    value: string
  ) {
    onChange({ ...data, [field]: { ...data[field], [drugKey]: value } })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <colgroup>
          {/* Patient name / label column */}
          <col className="w-[14%] min-w-[110px]" />
          {/* Sub-label column (for case rows) */}
          <col className="w-[12%] min-w-[100px]" />
          {/* 5 drug columns */}
          <col className="w-[14%] min-w-[100px]" />
          <col className="w-[14%] min-w-[100px]" />
          <col className="w-[14%] min-w-[100px]" />
          <col className="w-[14%] min-w-[100px]" />
          <col className="w-[14%] min-w-[100px]" />
        </colgroup>

        <tbody>
          {/* =============================================================
              ROW: Date navigation
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left")}>
              Date:
            </td>
            <td colSpan={DRUG_COUNT} className={cn(B, "bg-background px-3 py-2")}>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => onNavigateDate(-1)}
                  disabled={isPending}
                  aria-label="Previous day"
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
                  aria-label="Next day"
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
          </tr>

          {/* =============================================================
              ROW: Anesthesia MD + Print Name (same person)
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left")}>
              Anesthesia MD:
            </td>
            <td colSpan={DRUG_COUNT} className={cn(CELL)}>
              <div className="flex items-center gap-3">
                <Input
                  value={data.anesthesia_md}
                  onChange={(e) => {
                    updateTop("anesthesia_md", e.target.value)
                    updateTop("print_name", e.target.value)
                  }}
                  disabled={disabled}
                  className={TXT}
                  placeholder="Print name"
                />
              </div>
            </td>
          </tr>

          {/* =============================================================
              ROW: Drug column headers
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30")}>Item</td>
            {SIGNOUT_DRUGS.map((drug) => (
              <td key={drug.key} className={cn(HDR)}>
                {drug.label ? (
                  <span className="text-sm font-semibold leading-tight">{drug.label}</span>
                ) : (
                  <Input
                    value={data.custom_drug_name ?? ""}
                    onChange={(e) => updateTop("custom_drug_name", e.target.value)}
                    disabled={disabled}
                    className="h-auto border-0 bg-transparent p-0 text-center text-xs font-semibold shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                    placeholder="Custom drug"
                  />
                )}
              </td>
            ))}
          </tr>

          {/* =============================================================
              ROW: Anesthesiologist Signature (per drug)
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left text-xs")}>
              Anesthesiologist Signature
            </td>
            {SIGNOUT_DRUGS.map((drug) => (
              <td key={drug.key} className={cn(CELL, "px-2", isDraft && data.drug_headers[drug.key]?.anesthesiologist_sig && "bg-yellow-50")}>
                <SignatureCell
                  value={data.drug_headers[drug.key]?.anesthesiologist_sig ?? null}
                  onChange={(_p, b) => updateDrugHeader(drug.key, "anesthesiologist_sig", b)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                />
              </td>
            ))}
          </tr>

          {/* =============================================================
              ROW: Nurse Signature (per drug)
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left text-xs")}>
              Nurse Signature
            </td>
            {SIGNOUT_DRUGS.map((drug) => (
              <td key={drug.key} className={cn(CELL, "px-2", isDraft && data.drug_headers[drug.key]?.nurse_sig && "bg-yellow-50")}>
                <SignatureCell
                  value={data.drug_headers[drug.key]?.nurse_sig ?? null}
                  onChange={(_p, b) => updateDrugHeader(drug.key, "nurse_sig", b)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                />
              </td>
            ))}
          </tr>

          {/* =============================================================
              ROW: Quantity Dispensed (per drug)
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left text-xs")}>
              Quantity Dispensed (# of units)
            </td>
            {SIGNOUT_DRUGS.map((drug) => (
              <td key={drug.key} className={cn(CELL, isDraft && data.drug_headers[drug.key]?.qty_dispensed && "bg-yellow-50")}>
                <Input
                  value={data.drug_headers[drug.key]?.qty_dispensed ?? ""}
                  onChange={(e) => updateDrugHeader(drug.key, "qty_dispensed", e.target.value)}
                  disabled={disabled}
                  className={NUM}
                />
              </td>
            ))}
          </tr>

          {/* =============================================================
              CASE BLOCKS (5 patient cases)
              ============================================================= */}
          {data.cases.map((caseData, caseIdx) => (
            <CaseBlock
              key={caseIdx}
              caseIdx={caseIdx}
              caseData={caseData}
              onUpdateCase={updateCase}
              onUpdateAmount={updateCaseAmount}
              locationId={locationId}
              disabled={disabled}
              isDraft={isDraft}
              defaultSignerName={myProfile?.name}
            />
          ))}

          {/* =============================================================
              ROW: Total Quantity Used (per drug)
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left")}>
              Total Quantity Used (# units)
            </td>
            {SIGNOUT_DRUGS.map((drug) => (
              <td key={drug.key} className={cn(CELL, isDraft && data.total_qty_used[drug.key] && "bg-yellow-50")}>
                <Input
                  value={data.total_qty_used[drug.key] ?? ""}
                  onChange={(e) => updateRecord("total_qty_used", drug.key, e.target.value)}
                  disabled={disabled}
                  className={NUM}
                />
              </td>
            ))}
          </tr>

          {/* =============================================================
              ROW: End Balance Returned (per drug)
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left")}>
              End Balance Returned (# of units)
            </td>
            {SIGNOUT_DRUGS.map((drug) => (
              <td key={drug.key} className={cn(CELL, isDraft && data.end_balance[drug.key] && "bg-yellow-50")}>
                <Input
                  value={data.end_balance[drug.key] ?? ""}
                  onChange={(e) => updateRecord("end_balance", drug.key, e.target.value)}
                  disabled={disabled}
                  className={NUM}
                />
              </td>
            ))}
          </tr>

          {/* =============================================================
              ROW: RN Signature (spans all drug columns)
              ============================================================= */}
          <tr>
            <td colSpan={2} className={cn(HDR, "sticky left-0 z-10 bg-muted/30 text-left")}>
              RN Signature
            </td>
            <td colSpan={DRUG_COUNT} className={cn(CELL, "px-2", isDraft && data.rn_signature && "bg-yellow-50")}>
              <div className="mx-auto max-w-[200px]">
                <SignatureCell
                  value={data.rn_signature}
                  onChange={(_p, b) => updateTop("rn_signature", b)}
                  locationId={locationId}
                  disabled={disabled}
                  defaultSignerName={myProfile?.name}
                />
              </div>
            </td>
          </tr>

          {/* =============================================================
              Note
              ============================================================= */}
          <tr>
            <td
              colSpan={2 + DRUG_COUNT}
              className={cn(B, "bg-muted/10 px-3 py-2 text-center text-xs font-medium italic text-muted-foreground")}
            >
              Co-Signature Required For All Wasted Doses
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Case block sub-component (Patient Name, Amount Administered, Amount Wasted,
// Co-Signature) — extracted for readability
// ---------------------------------------------------------------------------

function CaseBlock({
  caseIdx,
  caseData,
  onUpdateCase,
  onUpdateAmount,
  locationId,
  disabled,
  isDraft,
  defaultSignerName,
}: {
  caseIdx: number
  caseData: NarcoticSignoutLogData["cases"][number]
  onUpdateCase: (
    idx: number,
    updates: Partial<NarcoticSignoutLogData["cases"][number]>
  ) => void
  onUpdateAmount: (
    caseIdx: number,
    drugKey: string,
    field: "administered" | "wasted",
    value: string
  ) => void
  locationId: string
  disabled?: boolean
  isDraft?: boolean
  defaultSignerName?: string
}) {
  return (
    <>
      {/* Row 1: Patient Name (rowSpan=3) + Amount Administered */}
      <tr>
        {/* Patient name cell spanning 3 rows */}
        <td
          rowSpan={3}
          className={cn(
            B,
            "align-middle px-2 py-1.5 text-center",
            isDraft && caseData.patient_name && "bg-yellow-50"
          )}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground">
              Case {caseIdx + 1}
            </span>
            <Input
              value={caseData.patient_name}
              onChange={(e) => onUpdateCase(caseIdx, { patient_name: e.target.value })}
              disabled={disabled}
              className={cn(TXT, "text-center")}
              placeholder="Patient name"
            />
          </div>
        </td>
        {/* Sub-label: Amount Administered */}
        <td className={cn(HDR, "text-left text-[10px] leading-tight")}>
          Amt Administered
        </td>
        {/* Drug cells */}
        {SIGNOUT_DRUGS.map((drug) => (
          <td key={drug.key} className={cn(CELL, isDraft && caseData.amounts[drug.key]?.administered && "bg-yellow-50")}>
            <Input
              value={caseData.amounts[drug.key]?.administered ?? ""}
              onChange={(e) => onUpdateAmount(caseIdx, drug.key, "administered", e.target.value)}
              disabled={disabled}
              className={NUM}
            />
          </td>
        ))}
      </tr>

      {/* Row 2: Amount Wasted (no patient name cell - covered by rowSpan) */}
      <tr>
        <td className={cn(HDR, "text-left text-[10px] leading-tight")}>
          Amt Wasted
        </td>
        {SIGNOUT_DRUGS.map((drug) => (
          <td key={drug.key} className={cn(CELL, isDraft && caseData.amounts[drug.key]?.wasted && "bg-yellow-50")}>
            <Input
              value={caseData.amounts[drug.key]?.wasted ?? ""}
              onChange={(e) => onUpdateAmount(caseIdx, drug.key, "wasted", e.target.value)}
              disabled={disabled}
              className={NUM}
            />
          </td>
        ))}
      </tr>

      {/* Row 3: Co-Signature (no patient name cell - covered by rowSpan) */}
      <tr>
        <td className={cn(HDR, "text-left text-[10px] leading-tight")}>
          Co-Signature
        </td>
        <td colSpan={DRUG_COUNT} className={cn(CELL, "px-2", isDraft && caseData.co_signature && "bg-yellow-50")}>
          <div className="mx-auto max-w-[200px]">
            <SignatureCell
              value={caseData.co_signature}
              onChange={(_p, b) => onUpdateCase(caseIdx, { co_signature: b })}
              locationId={locationId}
              disabled={disabled}
              defaultSignerName={defaultSignerName}
            />
          </div>
        </td>
      </tr>
    </>
  )
}
