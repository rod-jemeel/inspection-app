import "server-only"
import { getFormImageUrl } from "@/lib/server/services/form-responses"
import type {
  FormFieldResponseWithField,
  FormResponseWithFields,
  FormTemplateSnapshot,
} from "@/lib/server/services/form-responses"
import type { FormResponseSyncPayload } from "./types"

type DynamicRecordValue = string | number | boolean | null

function sanitizeKey(label: string): string {
  const normalized = label
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return normalized || "field"
}

function toUniqueKeys(snapshot: FormTemplateSnapshot) {
  const keyCounts = new Map<string, number>()
  const keyByFieldId = new Map<string, string>()

  for (const field of snapshot.fields) {
    if (field.field_type === "section_header") continue

    const baseKey = sanitizeKey(field.label)
    const count = (keyCounts.get(baseKey) ?? 0) + 1
    keyCounts.set(baseKey, count)
    keyByFieldId.set(field.id, count === 1 ? baseKey : `${baseKey}_${count}`)
  }

  return keyByFieldId
}

function normalizeDynamicValue(field: FormTemplateSnapshot["fields"][number], response?: FormFieldResponseWithField): DynamicRecordValue {
  if (!response) return null

  switch (field.field_type) {
    case "boolean":
      if (response.value_boolean === null) return null
      if (response.value_boolean === true) return field.options?.[0] || "Yes"
      return field.options?.[1] || "No"
    case "number":
    case "temperature":
    case "pressure":
      return response.value_number
    case "date":
      return response.value_date
    case "datetime":
      return response.value_datetime
    case "multi_select": {
      const selected = response.value_json?.selected
      return Array.isArray(selected) && selected.length > 0 ? selected.join(", ") : null
    }
    case "signature":
    case "photo":
      return response.attachment_url
    default:
      return response.value_text
  }
}

function buildDynamicRecord(response: FormResponseWithFields): Record<string, DynamicRecordValue> {
  const record: Record<string, DynamicRecordValue> = {}
  const keyByFieldId = toUniqueKeys(response.template_snapshot)
  const responseByFieldId = new Map(
    response.field_responses.map((fieldResponse) => [fieldResponse.form_field_id, fieldResponse])
  )

  for (const field of response.template_snapshot.fields) {
    if (field.field_type === "section_header") continue

    const key = keyByFieldId.get(field.id)
    if (!key) continue

    record[key] = normalizeDynamicValue(field, responseByFieldId.get(field.id))
  }

  return record
}

export function buildFormResponseSyncPayload(params: {
  operation: "submitted" | "corrected"
  response: FormResponseWithFields
  googleSheetId: string | null
  googleSheetTab: string | null
  binderName: string | null
}): FormResponseSyncPayload {
  const { operation, response, googleSheetId, googleSheetTab, binderName } = params
  const isCorrection = operation === "corrected"

  return {
    event: isCorrection ? "form_response_corrected" : "form_response_submitted",
    operation,
    timestamp: new Date().toISOString(),
    response_id: response.id,
    revision_number: response.current_revision_number,
    form_template_id: response.form_template_id,
    form_template_name: response.template_snapshot.name || response.form_template_name || "Unnamed Form",
    binder_name: binderName,
    location_id: response.location_id,
    submitted_at: response.submitted_at,
    original_submitted_at: response.original_submitted_at,
    last_edited_at: response.last_edited_at,
    status: response.status,
    overall_pass: response.overall_pass,
    google_sheet_id: googleSheetId,
    google_sheet_tab: googleSheetTab,
    submitted_by: {
      profile_id: response.submitted_by_profile_id,
      name: response.submitted_by_name ?? null,
    },
    last_edited_by: response.last_edited_by_profile_id
      ? {
          profile_id: response.last_edited_by_profile_id,
          name: response.last_edited_by_name ?? null,
        }
      : null,
    record: buildDynamicRecord(response),
    media: {
      completion_signature: response.completion_signature
        ? getFormImageUrl(response.id, "signature")
        : null,
      completion_selfie: response.completion_selfie
        ? getFormImageUrl(response.id, "selfie")
        : null,
    },
  }
}
