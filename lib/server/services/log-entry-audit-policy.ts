import type { LogEntryAuditLogType } from "@/lib/validations/log-entry-events"

export type RedactionMode =
  | "FULL"
  | "MASK_TEXT"
  | "MASK_NAME"
  | "SIGNATURE_META"
  | "SECRET_REDACT"

const SIGNATURE_KEY_RE = /(^signature$|_signature$|^sig$|^sig\d+$|_sig\d*$|^rn_sig$|^witness_sig$)/i

export function isSignaturePath(path: string): boolean {
  if (/\b(initials_audits|initials_signatures)\b.*(\.sig$|\[\d+\]\.sig$)/.test(path)) return true
  const lastToken = path.split(".").at(-1)?.replace(/\[\d+\]/g, "") ?? ""
  return SIGNATURE_KEY_RE.test(lastToken)
}

export function isLockCodePath(path: string): boolean {
  return path.startsWith("lock_digits[") || path.includes(".new_lock")
}

function isPatientNamePath(path: string): boolean {
  return /(^patient_name$|\.patient_name$|^rows\[\d+\]\.patient$|\.patient$)/.test(path)
}

function isSensitiveFreeTextPath(path: string): boolean {
  return (
    path === "admission_diagnosis" ||
    path === "history_prior" ||
    path === "initial_signs.other" ||
    path === "site_of_arrest" ||
    path === "intubated_by" ||
    path === "ett_size" ||
    path === "intubation_time" ||
    path === "code_terminated_by" ||
    path === "patient_outcome" ||
    path === "transferred_to" ||
    path === "neuro_status" ||
    /^rows\[\d+\]\.(other_drug|other_iv|comments)$/.test(path) ||
    /^notes\./.test(path) ||
    path === "bottom_notes" ||
    /^lock_changes\[\d+\]\.date_reason$/.test(path)
  )
}

function isNarcoticCountValuePath(path: string): boolean {
  return (
    /^beginning_count\./.test(path) ||
    /^end_count\./.test(path) ||
    /^rows\[\d+\]\.(versed|versed_waste|fentanyl|fentanyl_waste|drug3|drug3_waste)$/.test(path) ||
    /^entries\[\d+\]\.(fentanyl|midazolam|ephedrine)\.(am|rcvd|used|pm)$/.test(path) ||
    /^cases\[\d+\]\.amounts\./.test(path) ||
    /^total_qty_used\./.test(path) ||
    /^end_balance\./.test(path) ||
    /^rows\[\d+\]\.(qty_in_stock|amt_ordered|amt_used|amt_wasted)$/.test(path) ||
    path === "initial_stock"
  )
}

export function resolveAuditFieldPolicy(
  logType: LogEntryAuditLogType,
  path: string
): RedactionMode {
  if (path === "status") return "FULL"
  if (isLockCodePath(path)) return "SECRET_REDACT"
  if (isSignaturePath(path)) return "SIGNATURE_META"
  if (isPatientNamePath(path)) return "MASK_NAME"
  if (isNarcoticCountValuePath(path)) return "FULL"

  switch (logType) {
    case "cardiac_arrest_record":
      if (isSensitiveFreeTextPath(path)) return "MASK_TEXT"
      return "FULL"
    case "crash_cart_daily":
      if (isSensitiveFreeTextPath(path)) return "MASK_TEXT"
      return "FULL"
    default:
      return "FULL"
  }
}
