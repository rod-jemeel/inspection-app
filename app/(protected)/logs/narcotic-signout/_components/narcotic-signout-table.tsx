"use client"

import { Input } from "@/components/ui/input"
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

function StickyLabelCell({
  children,
  className,
  colSpan = 2,
}: {
  children: React.ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td colSpan={colSpan} className={cn(HDR, "sticky left-0 z-10 bg-muted/30", className)}>
      {children}
    </td>
  )
}

function DrugColumns({
  children,
}: {
  children: (drug: (typeof SIGNOUT_DRUGS)[number]) => React.ReactNode
}) {
  return <>{SIGNOUT_DRUGS.map((drug) => children(drug))}</>
}

function SignoutDateRow({ date }: { date: string }) {
  return (
    <tr>
      <StickyLabelCell className="text-left">Date:</StickyLabelCell>
      <td colSpan={DRUG_COUNT} className={cn(B, "bg-background px-3 py-2")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="whitespace-nowrap text-sm font-medium">
            {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span className="text-[11px] text-muted-foreground">Change date in toolbar</span>
        </div>
      </td>
    </tr>
  )
}

function SignoutTopFieldsRow({
  data,
  disabled,
  onUpdateTop,
}: {
  data: NarcoticSignoutLogData
  disabled?: boolean
  onUpdateTop: <K extends keyof NarcoticSignoutLogData>(
    field: K,
    value: NarcoticSignoutLogData[K]
  ) => void
}) {
  return (
    <tr>
      <StickyLabelCell className="text-left">Anesthesia MD:</StickyLabelCell>
      <td colSpan={DRUG_COUNT} className={cn(CELL)}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input
            value={data.anesthesia_md}
            onChange={(e) => onUpdateTop("anesthesia_md", e.target.value)}
            disabled={disabled}
            className={TXT}
            placeholder="Print Name"
            aria-label="Anesthesia MD"
          />
          <Input
            value={data.print_name}
            onChange={(e) => onUpdateTop("print_name", e.target.value)}
            disabled={disabled}
            className={TXT}
            placeholder="Printed name"
            aria-label="Print Name"
          />
        </div>
      </td>
    </tr>
  )
}

function DrugHeaderRow({
  data,
  disabled,
  onUpdateTop,
}: {
  data: NarcoticSignoutLogData
  disabled?: boolean
  onUpdateTop: <K extends keyof NarcoticSignoutLogData>(
    field: K,
    value: NarcoticSignoutLogData[K]
  ) => void
}) {
  return (
    <tr>
      <StickyLabelCell>Item</StickyLabelCell>
      <DrugColumns>
        {(drug) => (
          <td key={drug.key} className={cn(HDR)}>
            {drug.label ? (
              <span className="text-sm font-semibold leading-tight">{drug.label}</span>
            ) : (
              <Input
                value={data.custom_drug_name ?? ""}
                onChange={(e) => onUpdateTop("custom_drug_name", e.target.value)}
                disabled={disabled}
                className="h-auto border-0 bg-transparent p-0 text-center text-xs font-semibold shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                placeholder="Custom drug"
              />
            )}
          </td>
        )}
      </DrugColumns>
    </tr>
  )
}

function PerDrugSignatureRow({
  title,
  role,
  data,
  locationId,
  disabled,
  isDraft,
  defaultSignerName,
  onUpdateDrugHeader,
  onUpdateDrugHeaderMeta,
}: {
  title: string
  role: "anesthesiologist" | "nurse"
  data: NarcoticSignoutLogData
  locationId: string
  disabled?: boolean
  isDraft?: boolean
  defaultSignerName?: string
  onUpdateDrugHeader: (
    drugKey: string,
    field:
      | "anesthesiologist_sig"
      | "anesthesiologist_sig_signer_name"
      | "anesthesiologist_sig_signed_at"
      | "nurse_sig"
      | "nurse_sig_signer_name"
      | "nurse_sig_signed_at"
      | "qty_dispensed",
    value: string | null
  ) => void
  onUpdateDrugHeaderMeta: (
    drugKey: string,
    role: "anesthesiologist" | "nurse",
    meta: { signerName: string; signedAt: string; signatureBase64?: string } | null
  ) => void
}) {
  const valueField = role === "anesthesiologist" ? "anesthesiologist_sig" : "nurse_sig"
  const signerField =
    role === "anesthesiologist"
      ? "anesthesiologist_sig_signer_name"
      : "nurse_sig_signer_name"
  const signedAtField =
    role === "anesthesiologist"
      ? "anesthesiologist_sig_signed_at"
      : "nurse_sig_signed_at"

  return (
    <tr>
      <StickyLabelCell className="text-left text-xs">{title}</StickyLabelCell>
      <DrugColumns>
        {(drug) => (
          <td
            key={drug.key}
            className={cn(CELL, "px-2", isDraft && data.drug_headers[drug.key]?.[valueField] && "bg-yellow-50")}
          >
            <SignatureCell
              value={data.drug_headers[drug.key]?.[valueField] ?? null}
              onChange={(_p, base64) => onUpdateDrugHeader(drug.key, valueField, base64)}
              locationId={locationId}
              disabled={disabled}
              defaultSignerName={defaultSignerName}
              signerName={data.drug_headers[drug.key]?.[signerField] ?? ""}
              signedAt={data.drug_headers[drug.key]?.[signedAtField] ?? ""}
              onSignedMetaChange={(meta) => onUpdateDrugHeaderMeta(drug.key, role, meta)}
              emptyLabel="Add"
            />
          </td>
        )}
      </DrugColumns>
    </tr>
  )
}

function QuantityDispensedRow({
  data,
  disabled,
  isDraft,
  onUpdateDrugHeader,
}: {
  data: NarcoticSignoutLogData
  disabled?: boolean
  isDraft?: boolean
  onUpdateDrugHeader: (
    drugKey: string,
    field: "qty_dispensed",
    value: string | null
  ) => void
}) {
  return (
    <tr>
      <StickyLabelCell className="text-left text-xs">
        Quantity Dispensed (# of units)
      </StickyLabelCell>
      <DrugColumns>
        {(drug) => (
          <td
            key={drug.key}
            className={cn(CELL, isDraft && data.drug_headers[drug.key]?.qty_dispensed && "bg-yellow-50")}
          >
            <Input
              value={data.drug_headers[drug.key]?.qty_dispensed ?? ""}
              onChange={(e) => onUpdateDrugHeader(drug.key, "qty_dispensed", e.target.value)}
              disabled={disabled}
              className={NUM}
            />
          </td>
        )}
      </DrugColumns>
    </tr>
  )
}

function PerDrugTotalsRow({
  title,
  valueMap,
  disabled,
  isDraft,
  onUpdateRecord,
  field,
}: {
  title: string
  valueMap: Record<string, string>
  disabled?: boolean
  isDraft?: boolean
  field: "total_qty_used" | "end_balance"
  onUpdateRecord: (
    field: "total_qty_used" | "end_balance",
    drugKey: string,
    value: string
  ) => void
}) {
  return (
    <tr>
      <StickyLabelCell className="text-left">{title}</StickyLabelCell>
      <DrugColumns>
        {(drug) => (
          <td key={drug.key} className={cn(CELL, isDraft && valueMap[drug.key] && "bg-yellow-50")}>
            <Input
              value={valueMap[drug.key] ?? ""}
              onChange={(e) => onUpdateRecord(field, drug.key, e.target.value)}
              disabled={disabled}
              className={NUM}
            />
          </td>
        )}
      </DrugColumns>
    </tr>
  )
}

function FinalRnSignatureRow({
  data,
  locationId,
  disabled,
  isDraft,
  defaultSignerName,
  onChange,
}: {
  data: NarcoticSignoutLogData
  locationId: string
  disabled?: boolean
  isDraft?: boolean
  defaultSignerName?: string
  onChange: (data: NarcoticSignoutLogData) => void
}) {
  return (
    <tr>
      <StickyLabelCell className="text-left">RN Signature</StickyLabelCell>
      <td colSpan={DRUG_COUNT} className={cn(CELL, "px-2", isDraft && data.rn_signature && "bg-yellow-50")}>
        <div className="mx-auto max-w-[200px]">
          <SignatureCell
            value={data.rn_signature}
            onChange={(_p, base64) => onChange({ ...data, rn_signature: base64 })}
            locationId={locationId}
            disabled={disabled}
            defaultSignerName={defaultSignerName}
            signerName={data.rn_signature_signer_name}
            signedAt={data.rn_signature_signed_at}
            onSignedMetaChange={(meta) =>
              onChange({
                ...data,
                rn_signature: meta?.signatureBase64 ?? null,
                rn_signature_signer_name: meta?.signerName ?? "",
                rn_signature_signed_at: meta?.signedAt ?? "",
              })
            }
            emptyLabel="Add Signature"
          />
        </div>
      </td>
    </tr>
  )
}

export function NarcoticSignoutTable({
  data,
  onChange,
  locationId,
  disabled,
  date,
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
    field:
      | "anesthesiologist_sig"
      | "anesthesiologist_sig_signer_name"
      | "anesthesiologist_sig_signed_at"
      | "nurse_sig"
      | "nurse_sig_signer_name"
      | "nurse_sig_signed_at"
      | "qty_dispensed",
    value: string | null
  ) {
    const headers = { ...data.drug_headers }
    headers[drugKey] = {
      ...(headers[drugKey] ?? {
        anesthesiologist_sig: null,
        anesthesiologist_sig_signer_name: "",
        anesthesiologist_sig_signed_at: "",
        nurse_sig: null,
        nurse_sig_signer_name: "",
        nurse_sig_signed_at: "",
        qty_dispensed: "",
      }),
      [field]: value,
    }
    onChange({ ...data, drug_headers: headers })
  }

  function updateDrugHeaderMeta(
    drugKey: string,
    role: "anesthesiologist" | "nurse",
    meta: { signerName: string; signedAt: string; signatureBase64?: string } | null
  ) {
    const headers = { ...data.drug_headers }
    const current = headers[drugKey] ?? {
      anesthesiologist_sig: null,
      anesthesiologist_sig_signer_name: "",
      anesthesiologist_sig_signed_at: "",
      nurse_sig: null,
      nurse_sig_signer_name: "",
      nurse_sig_signed_at: "",
      qty_dispensed: "",
    }
    headers[drugKey] = {
      ...current,
      ...(role === "anesthesiologist"
        ? {
            anesthesiologist_sig: meta?.signatureBase64 ?? null,
            anesthesiologist_sig_signer_name: meta?.signerName ?? "",
            anesthesiologist_sig_signed_at: meta?.signedAt ?? "",
          }
        : {
            nurse_sig: meta?.signatureBase64 ?? null,
            nurse_sig_signer_name: meta?.signerName ?? "",
            nurse_sig_signed_at: meta?.signedAt ?? "",
          }),
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
          <SignoutDateRow date={date} />
          <SignoutTopFieldsRow data={data} disabled={disabled} onUpdateTop={updateTop} />
          <DrugHeaderRow data={data} disabled={disabled} onUpdateTop={updateTop} />
          <PerDrugSignatureRow
            title="Anesthesiologist Signature"
            role="anesthesiologist"
            data={data}
            locationId={locationId}
            disabled={disabled}
            isDraft={isDraft}
            defaultSignerName={myProfile?.name}
            onUpdateDrugHeader={updateDrugHeader}
            onUpdateDrugHeaderMeta={updateDrugHeaderMeta}
          />
          <PerDrugSignatureRow
            title="Nurse Signature"
            role="nurse"
            data={data}
            locationId={locationId}
            disabled={disabled}
            isDraft={isDraft}
            defaultSignerName={myProfile?.name}
            onUpdateDrugHeader={updateDrugHeader}
            onUpdateDrugHeaderMeta={updateDrugHeaderMeta}
          />
          <QuantityDispensedRow
            data={data}
            disabled={disabled}
            isDraft={isDraft}
            onUpdateDrugHeader={(drugKey, _field, value) => updateDrugHeader(drugKey, "qty_dispensed", value)}
          />

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

          <PerDrugTotalsRow
            title="Total Quantity Used (# units)"
            valueMap={data.total_qty_used}
            disabled={disabled}
            isDraft={isDraft}
            field="total_qty_used"
            onUpdateRecord={updateRecord}
          />
          <PerDrugTotalsRow
            title="End Balance Returned (# of units)"
            valueMap={data.end_balance}
            disabled={disabled}
            isDraft={isDraft}
            field="end_balance"
            onUpdateRecord={updateRecord}
          />
          <FinalRnSignatureRow
            data={data}
            locationId={locationId}
            disabled={disabled}
            isDraft={isDraft}
            defaultSignerName={myProfile?.name}
            onChange={onChange}
          />
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
              signerName={caseData.co_signature_signer_name}
              signedAt={caseData.co_signature_signed_at}
              onSignedMetaChange={(meta) =>
                onUpdateCase(caseIdx, {
                  co_signature: meta?.signatureBase64 ?? null,
                  co_signature_signer_name: meta?.signerName ?? "",
                  co_signature_signed_at: meta?.signedAt ?? "",
                })
              }
              emptyLabel="Add Signature"
            />
          </div>
        </td>
      </tr>
    </>
  )
}
