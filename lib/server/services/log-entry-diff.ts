import { createHash } from "node:crypto"
import type { LogEntryAuditLogType } from "@/lib/validations/log-entry-events"
import { isSignaturePath, resolveAuditFieldPolicy, type RedactionMode } from "./log-entry-audit-policy"

type JsonRecord = Record<string, unknown>

export type AuditChangeKind = "add" | "update" | "remove"

export interface LogEntryAuditChange {
  path: string
  kind: AuditChangeKind
  mode: RedactionMode
  redacted: boolean
  oldValue?: unknown
  newValue?: unknown
}

export interface LogEntryAuditSummary {
  change_count: number
  redacted_change_count: number
  signature_change_count: number
  status_before?: "draft" | "complete" | null
  status_after?: "draft" | "complete" | null
}

interface RawChange {
  path: string
  kind: AuditChangeKind
  oldValue?: unknown
  newValue?: unknown
}

export interface DiffLogEntryAuditInput {
  logType: LogEntryAuditLogType
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown>
  oldStatus: "draft" | "complete" | null
  newStatus: "draft" | "complete"
}

function isPlainObject(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isBlankLike(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  )
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (isPlainObject(value)) {
    const out: JsonRecord = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key])
    }
    return out
  }
  return value
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (typeof a !== "object") return a === b
  return stableJson(a) === stableJson(b)
}

function joinPath(base: string, segment: string): string {
  if (!base) return segment
  return segment.startsWith("[") ? `${base}${segment}` : `${base}.${segment}`
}

function diffNode(oldValue: unknown, newValue: unknown, path: string, out: RawChange[]) {
  if (valuesEqual(oldValue, newValue)) return

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const len = Math.max(oldValue.length, newValue.length)
    for (let i = 0; i < len; i++) {
      const hasOld = i < oldValue.length
      const hasNew = i < newValue.length
      const childPath = joinPath(path, `[${i}]`)
      if (!hasOld && hasNew) {
        out.push({ path: childPath, kind: "add", newValue: newValue[i] })
        continue
      }
      if (hasOld && !hasNew) {
        out.push({ path: childPath, kind: "remove", oldValue: oldValue[i] })
        continue
      }
      diffNode(oldValue[i], newValue[i], childPath, out)
    }
    return
  }

  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)])
    for (const key of Array.from(keys).sort()) {
      const hasOld = Object.prototype.hasOwnProperty.call(oldValue, key)
      const hasNew = Object.prototype.hasOwnProperty.call(newValue, key)
      const childPath = joinPath(path, key)
      if (!hasOld && hasNew) {
        out.push({ path: childPath, kind: "add", newValue: newValue[key] })
        continue
      }
      if (hasOld && !hasNew) {
        out.push({ path: childPath, kind: "remove", oldValue: oldValue[key] })
        continue
      }
      diffNode(oldValue[key], newValue[key], childPath, out)
    }
    return
  }

  out.push({
    path,
    kind: oldValue === undefined ? "add" : newValue === undefined ? "remove" : "update",
    oldValue,
    newValue,
  })
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12)
}

function summarizeTextValue(value: unknown) {
  const text = typeof value === "string" ? value : value == null ? "" : String(value)
  return {
    blank: isBlankLike(value),
    length: text.length,
    hash: hashText(text),
  }
}

function summarizeSignatureValue(value: unknown) {
  const text = typeof value === "string" ? value : value == null ? "" : String(value)
  return {
    state: isBlankLike(value) ? "blank" : "present",
    hash: text ? hashText(text) : null,
  }
}

export function redactAuditChange(
  logType: LogEntryAuditLogType,
  raw: RawChange
): LogEntryAuditChange {
  const mode = resolveAuditFieldPolicy(logType, raw.path)

  if (mode === "FULL") {
    return {
      path: raw.path,
      kind: raw.kind,
      mode,
      redacted: false,
      oldValue: raw.oldValue,
      newValue: raw.newValue,
    }
  }

  if (mode === "SIGNATURE_META") {
    return {
      path: raw.path,
      kind: raw.kind,
      mode,
      redacted: true,
      oldValue: summarizeSignatureValue(raw.oldValue),
      newValue: summarizeSignatureValue(raw.newValue),
    }
  }

  if (mode === "MASK_TEXT" || mode === "MASK_NAME") {
    return {
      path: raw.path,
      kind: raw.kind,
      mode,
      redacted: true,
      oldValue: summarizeTextValue(raw.oldValue),
      newValue: summarizeTextValue(raw.newValue),
    }
  }

  return {
    path: raw.path,
    kind: raw.kind,
    mode,
    redacted: true,
    oldValue: { blank: isBlankLike(raw.oldValue) },
    newValue: { blank: isBlankLike(raw.newValue) },
  }
}

export function diffLogEntryAudit(input: DiffLogEntryAuditInput): {
  changes: LogEntryAuditChange[]
  summary: LogEntryAuditSummary
} {
  const rawChanges: RawChange[] = []
  diffNode(input.oldData ?? {}, input.newData, "", rawChanges)

  if (input.oldStatus !== input.newStatus) {
    rawChanges.push({
      path: "status",
      kind: input.oldStatus == null ? "add" : "update",
      oldValue: input.oldStatus,
      newValue: input.newStatus,
    })
  }

  const changes = rawChanges
    .filter((c) => c.path !== "")
    .map((c) => redactAuditChange(input.logType, c))

  return {
    changes,
    summary: {
      change_count: changes.length,
      redacted_change_count: changes.filter((c) => c.redacted).length,
      signature_change_count: changes.filter((c) => c.mode === "SIGNATURE_META" || isSignaturePath(c.path)).length,
      status_before: input.oldStatus,
      status_after: input.newStatus,
    },
  }
}

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex")
}

function countNonEmptyLeafValues(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + countNonEmptyLeafValues(item), 0)
  }
  if (isPlainObject(value)) {
    return Object.values(value).reduce<number>((sum, item) => sum + countNonEmptyLeafValues(item), 0)
  }
  return isBlankLike(value) ? 0 : 1
}

function countArrayLengths(data: Record<string, unknown>) {
  const keys = ["rows", "entries", "cases", "signatures", "lock_changes"]
  const out: Record<string, number> = {}
  for (const key of keys) {
    const value = data[key]
    if (Array.isArray(value)) out[key] = value.length
  }
  return out
}

function detectAnySignatureValues(value: unknown, path = ""): boolean {
  if (Array.isArray(value)) {
    return value.some((item, index) => detectAnySignatureValues(item, joinPath(path, `[${index}]`)))
  }
  if (isPlainObject(value)) {
    return Object.entries(value).some(([key, child]) => detectAnySignatureValues(child, joinPath(path, key)))
  }
  if (!isSignaturePath(path)) return false
  return !isBlankLike(value)
}

export function buildDeleteAuditPayload(params: {
  logType: LogEntryAuditLogType
  status: "draft" | "complete"
  data: Record<string, unknown>
}) {
  const { logType, status, data } = params
  return {
    summary: {
      status,
      log_type: logType,
      non_empty_field_count: countNonEmptyLeafValues(data),
      had_signatures: detectAnySignatureValues(data),
      row_counts: countArrayLengths(data),
    },
    pre_delete_data_hash: hashCanonicalJson(data),
  }
}
