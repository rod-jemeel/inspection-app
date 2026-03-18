import "server-only"
import sharp from "sharp"
import { unstable_cache, revalidateTag } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import { getFormTemplate, type FormTemplate } from "@/lib/server/services/form-templates"
import { listFormFields, type FormField } from "@/lib/server/services/form-fields"
import type {
  SubmitFormResponseInput,
  UpdateFormResponseInput,
  FilterResponsesInput,
  FieldResponseInput,
} from "@/lib/validations/form-response"

// ---------------------------------------------------------------------------
// Storage helpers for completion images (signature / selfie)
// ---------------------------------------------------------------------------

/**
 * Upload a base64 data URL image to Supabase Storage.
 * Returns the storage path (not the full URL).
 */
export async function uploadFormImage(
  formTemplateId: string,
  profileId: string,
  base64DataUrl: string,
  type: "signature" | "selfie"
): Promise<string> {
  const bucket = process.env.SIGNATURES_BUCKET ?? "signatures"

  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) throw new ApiError("VALIDATION_ERROR", "Invalid image data URL")

  const contentType = matches[1]
  const base64Data = matches[2]
  const rawBuffer = Buffer.from(base64Data, "base64")

  // Trim whitespace around signatures for cleaner display
  let uploadBuffer: Uint8Array = rawBuffer
  let uploadContentType = contentType
  let ext = contentType.split("/")[1]?.replace("jpeg", "jpg") || "png"

  if (type === "signature") {
    uploadBuffer = await sharp(rawBuffer)
      .trim()
      .extend({
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer()
    uploadContentType = "image/png"
    ext = "png"
  }

  const path = `form-responses/${formTemplateId}/${profileId}-${Date.now()}-${type}.${ext}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, uploadBuffer, {
      contentType: uploadContentType,
      upsert: false,
    })

  if (error) throw new ApiError("INTERNAL_ERROR", `Image upload failed: ${error.message}`)
  return path
}

/**
 * Build a short redirect URL for a form response image.
 * The /api/files/:responseId?type=signature|selfie endpoint
 * creates a short-lived signed URL on demand and redirects.
 */
export async function getFormImageUrl(storagePath: string): Promise<string | null> {
  const bucket = process.env.SIGNATURES_BUCKET ?? "signatures"
  const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 31536000)
  return data?.signedUrl ?? null
}

function getFormRevisionImageUrl(
  responseId: string,
  revisionNumber: number,
  type: "signature" | "selfie"
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${baseUrl}/api/files/${responseId}?type=${type}&revision=${revisionNumber}`
}

function revalidateResponsesCache(locationId: string) {
  revalidateTag("form-responses", "max")
  revalidateTag(`form-responses-${locationId}`, "max")
}

export interface FormFieldSnapshot {
  id: string
  form_template_id: string
  label: string
  field_type: string
  required: boolean
  options: string[] | null
  validation_rules: Record<string, unknown> | null
  help_text: string | null
  placeholder: string | null
  default_value: string | null
  sort_order: number
  active: boolean
}

export interface FormTemplateSnapshot {
  id: string
  binder_id: string
  location_id: string
  name: string
  description: string | null
  instructions: string | null
  frequency: string | null
  regulatory_reference: string | null
  retention_years: number | null
  fields: FormFieldSnapshot[]
}

export interface FormResponse {
  id: string
  form_template_id: string
  location_id: string
  inspection_instance_id: string | null
  submitted_by_profile_id: string
  submitted_at: string
  original_submitted_at: string
  status: "draft" | "complete" | "flagged"
  overall_pass: boolean | null
  remarks: string | null
  corrective_action: string | null
  completion_signature: string | null
  completion_selfie: string | null
  current_revision_number: number
  last_edited_at: string | null
  last_edited_by_profile_id: string | null
  created_at: string
  updated_at: string
  template_snapshot: FormTemplateSnapshot
  submitted_by_name?: string | null
  form_template_name?: string | null
  binder_name?: string | null
  last_edited_by_name?: string | null
}

export interface FormFieldResponse {
  id?: string
  form_response_id?: string
  form_field_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: Record<string, unknown> | null
  attachment_url: string | null
  pass: boolean | null
  created_at?: string
  updated_at?: string
}

export interface FormFieldResponseWithField extends FormFieldResponse {
  form_field?: {
    label: string
    field_type: string
    sort_order: number
  }
}

export interface FormResponseRevision {
  id: string
  revision_number: number
  change_type: "submitted" | "corrected"
  edited_at: string
  edited_by_profile_id: string | null
  edited_by_name: string | null
  status: "draft" | "complete" | "flagged"
  overall_pass: boolean | null
  remarks: string | null
  corrective_action: string | null
  completion_signature: string | null
  completion_selfie: string | null
  field_responses: FormFieldResponseWithField[]
  changed_fields: string[]
}

export interface FormResponseWithFields extends FormResponse {
  field_responses: FormFieldResponseWithField[]
  revisions: FormResponseRevision[]
}

type StoredRevisionRow = {
  id: string
  revision_number: number
  change_type: "submitted" | "corrected"
  edited_at: string
  edited_by_profile_id: string | null
  status: "draft" | "complete" | "flagged"
  overall_pass: boolean | null
  remarks: string | null
  corrective_action: string | null
  completion_signature: string | null
  completion_selfie: string | null
  template_snapshot: FormTemplateSnapshot
  field_responses_snapshot: FormFieldResponse[]
  edited_by_name: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toNullableRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.map((item) => String(item))
}

function mapFieldToSnapshot(field: FormField): FormFieldSnapshot {
  return {
    id: field.id,
    form_template_id: field.form_template_id,
    label: field.label,
    field_type: field.field_type,
    required: field.required,
    options: field.options,
    validation_rules: field.validation_rules,
    help_text: field.help_text,
    placeholder: field.placeholder,
    default_value: field.default_value,
    sort_order: field.sort_order,
    active: field.active,
  }
}

function mapRawFieldToSnapshot(raw: unknown): FormFieldSnapshot | null {
  if (!isRecord(raw)) return null

  return {
    id: String(raw.id ?? ""),
    form_template_id: String(raw.form_template_id ?? ""),
    label: String(raw.label ?? ""),
    field_type: String(raw.field_type ?? "text"),
    required: Boolean(raw.required),
    options: asStringArray(raw.options),
    validation_rules: toNullableRecord(raw.validation_rules),
    help_text: raw.help_text ? String(raw.help_text) : null,
    placeholder: raw.placeholder ? String(raw.placeholder) : null,
    default_value: raw.default_value ? String(raw.default_value) : null,
    sort_order: Number(raw.sort_order ?? 0),
    active: raw.active !== false,
  }
}

function normalizeTemplateSnapshot(raw: unknown): FormTemplateSnapshot | null {
  if (!isRecord(raw)) return null

  const rawFields = Array.isArray(raw.fields) ? raw.fields : []
  const fields = rawFields
    .map((field) => mapRawFieldToSnapshot(field))
    .filter((field): field is FormFieldSnapshot => field !== null)
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    id: String(raw.id ?? ""),
    binder_id: String(raw.binder_id ?? ""),
    location_id: String(raw.location_id ?? ""),
    name: String(raw.name ?? ""),
    description: raw.description ? String(raw.description) : null,
    instructions: raw.instructions ? String(raw.instructions) : null,
    frequency: raw.frequency ? String(raw.frequency) : null,
    regulatory_reference: raw.regulatory_reference ? String(raw.regulatory_reference) : null,
    retention_years: raw.retention_years !== null && raw.retention_years !== undefined
      ? Number(raw.retention_years)
      : null,
    fields,
  }
}

function buildTemplateSnapshot(template: FormTemplate, fields: FormField[]): FormTemplateSnapshot {
  return {
    id: template.id,
    binder_id: template.binder_id,
    location_id: template.location_id,
    name: template.name,
    description: template.description,
    instructions: template.instructions,
    frequency: template.frequency,
    regulatory_reference: template.regulatory_reference,
    retention_years: template.retention_years,
    fields: [...fields].sort((a, b) => a.sort_order - b.sort_order).map(mapFieldToSnapshot),
  }
}

async function buildTemplateSnapshotForResponse(
  locationId: string,
  formTemplateId: string
): Promise<FormTemplateSnapshot> {
  const [template, fields] = await Promise.all([
    getFormTemplate(locationId, formTemplateId),
    listFormFields(formTemplateId, { active: true }),
  ])

  return buildTemplateSnapshot(template, fields)
}

function normalizeFieldResponseInput(input: FieldResponseInput): FormFieldResponse {
  return {
    form_field_id: input.form_field_id,
    value_text: input.value_text ?? null,
    value_number: input.value_number ?? null,
    value_boolean: input.value_boolean ?? null,
    value_date: input.value_date ?? null,
    value_datetime: input.value_datetime ?? null,
    value_json: input.value_json ?? null,
    attachment_url: input.attachment_url ?? null,
    pass: input.pass ?? null,
  }
}

function normalizeFieldResponseRow(row: Record<string, unknown>): FormFieldResponse {
  return {
    id: row.id ? String(row.id) : undefined,
    form_response_id: row.form_response_id ? String(row.form_response_id) : undefined,
    form_field_id: String(row.form_field_id),
    value_text: row.value_text ? String(row.value_text) : null,
    value_number: row.value_number !== null && row.value_number !== undefined
      ? Number(row.value_number)
      : null,
    value_boolean: typeof row.value_boolean === "boolean" ? row.value_boolean : null,
    value_date: row.value_date ? String(row.value_date) : null,
    value_datetime: row.value_datetime ? String(row.value_datetime) : null,
    value_json: toNullableRecord(row.value_json),
    attachment_url: row.attachment_url ? String(row.attachment_url) : null,
    pass: typeof row.pass === "boolean" ? row.pass : null,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function normalizeStoredFieldResponse(raw: unknown): FormFieldResponse | null {
  if (!isRecord(raw)) return null
  return normalizeFieldResponseRow(raw)
}

function buildFieldOrder(snapshot: FormTemplateSnapshot) {
  return new Map(snapshot.fields.map((field) => [field.id, field.sort_order]))
}

function sortFieldResponsesBySnapshot(
  snapshot: FormTemplateSnapshot,
  responses: FormFieldResponse[]
): FormFieldResponse[] {
  const order = buildFieldOrder(snapshot)
  return [...responses].sort((a, b) => {
    const aOrder = order.get(a.form_field_id) ?? Number.MAX_SAFE_INTEGER
    const bOrder = order.get(b.form_field_id) ?? Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.form_field_id.localeCompare(b.form_field_id)
  })
}

function enrichFieldResponses(
  snapshot: FormTemplateSnapshot,
  responses: FormFieldResponse[]
): FormFieldResponseWithField[] {
  const fieldMap = new Map(snapshot.fields.map((field) => [field.id, field]))

  return sortFieldResponsesBySnapshot(snapshot, responses).map((response) => {
    const field = fieldMap.get(response.form_field_id)

    return {
      ...response,
      form_field: field
        ? {
            label: field.label,
            field_type: field.field_type,
            sort_order: field.sort_order,
          }
        : undefined,
    }
  })
}

function computeOverallPass(
  fieldResponses: Array<Pick<FormFieldResponse, "pass">>
): boolean | null {
  const passValues = fieldResponses
    .map((response) => response.pass)
    .filter((pass): pass is boolean => typeof pass === "boolean")

  return passValues.length > 0 ? passValues.every((pass) => pass) : null
}

function validateFieldResponseIds(
  snapshot: FormTemplateSnapshot,
  fieldResponses: Array<{ form_field_id: string }>
) {
  const validIds = new Set(snapshot.fields.map((field) => field.id))
  for (const fieldResponse of fieldResponses) {
    if (!validIds.has(fieldResponse.form_field_id)) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "One or more submitted field responses do not belong to this form version"
      )
    }
  }
}

async function fetchCurrentFieldResponses(responseId: string): Promise<FormFieldResponse[]> {
  const { data, error } = await supabase
    .from("form_field_responses")
    .select("*")
    .eq("form_response_id", responseId)
    .order("created_at", { ascending: true })

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  return (data ?? []).map((row) => normalizeFieldResponseRow(row as Record<string, unknown>))
}

function mergeFieldResponses(
  snapshot: FormTemplateSnapshot,
  current: FormFieldResponse[],
  incoming?: FieldResponseInput[]
): FormFieldResponse[] {
  if (!incoming || incoming.length === 0) {
    return sortFieldResponsesBySnapshot(snapshot, current)
  }

  const merged = new Map(current.map((response) => [response.form_field_id, response]))
  for (const next of incoming.map(normalizeFieldResponseInput)) {
    merged.set(next.form_field_id, next)
  }

  return sortFieldResponsesBySnapshot(snapshot, Array.from(merged.values()))
}

function fieldResponseComparableValue(response: FormFieldResponse | undefined) {
  return JSON.stringify({
    value_text: response?.value_text ?? null,
    value_number: response?.value_number ?? null,
    value_boolean: response?.value_boolean ?? null,
    value_date: response?.value_date ?? null,
    value_datetime: response?.value_datetime ?? null,
    value_json: response?.value_json ?? null,
    attachment_url: response?.attachment_url ?? null,
    pass: response?.pass ?? null,
  })
}

function summarizeRevisionChanges(
  previous: {
    status: string
    remarks: string | null
    corrective_action: string | null
    completion_signature: string | null
    completion_selfie: string | null
    field_responses: FormFieldResponse[]
  } | null,
  current: {
    status: string
    remarks: string | null
    corrective_action: string | null
    completion_signature: string | null
    completion_selfie: string | null
    field_responses: FormFieldResponse[]
  },
  snapshot: FormTemplateSnapshot
): string[] {
  if (!previous) return ["Initial submission"]

  const changes: string[] = []

  if (previous.status !== current.status) changes.push("Status")
  if ((previous.remarks ?? null) !== (current.remarks ?? null)) changes.push("Remarks")
  if ((previous.corrective_action ?? null) !== (current.corrective_action ?? null)) {
    changes.push("Corrective action")
  }
  if ((previous.completion_signature ?? null) !== (current.completion_signature ?? null)) {
    changes.push("Signature")
  }
  if ((previous.completion_selfie ?? null) !== (current.completion_selfie ?? null)) {
    changes.push("Selfie")
  }

  const previousMap = new Map(previous.field_responses.map((response) => [response.form_field_id, response]))
  const currentMap = new Map(current.field_responses.map((response) => [response.form_field_id, response]))

  for (const field of snapshot.fields) {
    if (fieldResponseComparableValue(previousMap.get(field.id)) !== fieldResponseComparableValue(currentMap.get(field.id))) {
      changes.push(field.label)
    }
  }

  if (changes.length <= 6) return changes
  return [
    ...changes.slice(0, 6),
    `${changes.length - 6} more changes`,
  ]
}

async function getStoredRevisionRows(responseId: string): Promise<StoredRevisionRow[]> {
  const { data, error } = await supabase
    .from("form_response_revisions")
    .select(`
      *,
      edited_by:profiles!form_response_revisions_edited_by_profile_id_fkey(full_name)
    `)
    .eq("form_response_id", responseId)
    .order("revision_number", { ascending: false })

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    const editedBy = record.edited_by as { full_name?: string } | null

    return {
      id: String(record.id),
      revision_number: Number(record.revision_number ?? 1),
      change_type: String(record.change_type) as "submitted" | "corrected",
      edited_at: String(record.edited_at),
      edited_by_profile_id: record.edited_by_profile_id ? String(record.edited_by_profile_id) : null,
      status: String(record.status) as "draft" | "complete" | "flagged",
      overall_pass: typeof record.overall_pass === "boolean" ? record.overall_pass : null,
      remarks: record.remarks ? String(record.remarks) : null,
      corrective_action: record.corrective_action ? String(record.corrective_action) : null,
      completion_signature: record.completion_signature ? String(record.completion_signature) : null,
      completion_selfie: record.completion_selfie ? String(record.completion_selfie) : null,
      template_snapshot: normalizeTemplateSnapshot(record.template_snapshot) ?? {
        id: "",
        binder_id: "",
        location_id: "",
        name: "",
        description: null,
        instructions: null,
        frequency: null,
        regulatory_reference: null,
        retention_years: null,
        fields: [],
      },
      field_responses_snapshot: (Array.isArray(record.field_responses_snapshot) ? record.field_responses_snapshot : [])
        .map((fieldResponse) => normalizeStoredFieldResponse(fieldResponse))
        .filter((fieldResponse): fieldResponse is FormFieldResponse => fieldResponse !== null),
      edited_by_name: editedBy?.full_name ?? null,
    }
  })
}

function mapResponseBaseRow(row: Record<string, unknown>): Omit<FormResponse, "template_snapshot" | "field_responses" | "revisions"> {
  const submittedBy = row.submitted_by as { full_name?: string } | null
  const formTemplate = row.form_template as { name?: string; binder_id?: string } | null


  return {
    id: String(row.id),
    form_template_id: String(row.form_template_id),
    location_id: String(row.location_id),
    inspection_instance_id: row.inspection_instance_id ? String(row.inspection_instance_id) : null,
    submitted_by_profile_id: String(row.submitted_by_profile_id),
    submitted_at: String(row.submitted_at),
    original_submitted_at: row.original_submitted_at
      ? String(row.original_submitted_at)
      : String(row.submitted_at),
    status: String(row.status) as "draft" | "complete" | "flagged",
    overall_pass: typeof row.overall_pass === "boolean" ? row.overall_pass : null,
    remarks: row.remarks ? String(row.remarks) : null,
    corrective_action: row.corrective_action ? String(row.corrective_action) : null,
    completion_signature: row.completion_signature ? String(row.completion_signature) : null,
    completion_selfie: row.completion_selfie ? String(row.completion_selfie) : null,
    current_revision_number: Number(row.current_revision_number ?? 1),
    last_edited_at: row.last_edited_at ? String(row.last_edited_at) : null,
    last_edited_by_profile_id: row.last_edited_by_profile_id ? String(row.last_edited_by_profile_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    submitted_by_name: submittedBy?.full_name ?? null,
    form_template_name: formTemplate?.name ?? null,
    binder_name: undefined,
    last_edited_by_name: null,
  }
}

async function getFormResponseRow(locationId: string, responseId: string) {
  const { data, error } = await supabase
    .from("form_responses")
    .select(`
      *,
      submitted_by:profiles!form_responses_submitted_by_profile_id_fkey(full_name),
      form_template:form_templates!form_responses_form_template_id_fkey(name, binder_id)
    `)
    .eq("id", responseId)
    .eq("location_id", locationId)
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Form response not found")
  return data as Record<string, unknown>
}

function throwMutationError(error: { message: string } | null, fallbackMessage: string): never {
  if (error?.message?.includes("Form response not found")) {
    throw new ApiError("NOT_FOUND", "Form response not found")
  }

  throw new ApiError("INTERNAL_ERROR", error?.message ?? fallbackMessage)
}

export async function submitFormResponse(
  locationId: string,
  profileId: string,
  input: SubmitFormResponseInput
): Promise<FormResponseWithFields> {
  const templateSnapshot = await buildTemplateSnapshotForResponse(locationId, input.form_template_id)
  validateFieldResponseIds(templateSnapshot, input.field_responses)

  const normalizedFieldResponses = input.field_responses.map(normalizeFieldResponseInput)
  const overallPass = computeOverallPass(normalizedFieldResponses)
  const submittedAt = new Date().toISOString()

  const { data: responseId, error } = await supabase.rpc("submit_form_response_with_history", {
    p_form_template_id: input.form_template_id,
    p_location_id: locationId,
    p_inspection_instance_id: input.inspection_instance_id ?? null,
    p_submitted_by_profile_id: profileId,
    p_submitted_at: submittedAt,
    p_status: input.status,
    p_overall_pass: overallPass,
    p_remarks: input.remarks ?? null,
    p_corrective_action: input.corrective_action ?? null,
    p_completion_signature: input.completion_signature ?? null,
    p_completion_selfie: input.completion_selfie ?? null,
    p_template_snapshot: templateSnapshot,
    p_field_responses: normalizedFieldResponses,
  })

  if (error || !responseId) {
    throwMutationError(error, "Failed to create response")
  }

  revalidateResponsesCache(locationId)
  return getFormResponse(locationId, String(responseId))
}

export async function getFormResponse(
  locationId: string,
  responseId: string
): Promise<FormResponseWithFields> {
  const responseRow = await getFormResponseRow(locationId, responseId)
  const baseResponse = mapResponseBaseRow(responseRow)
  const templateSnapshot =
    normalizeTemplateSnapshot(responseRow.template_snapshot) ??
    await buildTemplateSnapshotForResponse(locationId, baseResponse.form_template_id)

  const [currentFieldResponses, storedRevisions] = await Promise.all([
    fetchCurrentFieldResponses(responseId),
    getStoredRevisionRows(responseId),
  ])

  const revisionsAscending = [...storedRevisions].sort((a, b) => a.revision_number - b.revision_number)
  const revisions = revisionsAscending
    .map((revision, index) => {
      const previous = index > 0 ? revisionsAscending[index - 1] : null
      const revisionSnapshot = revision.template_snapshot.fields.length > 0
        ? revision.template_snapshot
        : templateSnapshot
      const fieldResponses = enrichFieldResponses(revisionSnapshot, revision.field_responses_snapshot)

      return {
        id: revision.id,
        revision_number: revision.revision_number,
        change_type: revision.change_type,
        edited_at: revision.edited_at,
        edited_by_profile_id: revision.edited_by_profile_id,
        edited_by_name: revision.edited_by_name,
        status: revision.status,
        overall_pass: revision.overall_pass,
        remarks: revision.remarks,
        corrective_action: revision.corrective_action,
        completion_signature: revision.completion_signature
          ? getFormRevisionImageUrl(responseId, revision.revision_number, "signature")
          : null,
        completion_selfie: revision.completion_selfie
          ? getFormRevisionImageUrl(responseId, revision.revision_number, "selfie")
          : null,
        field_responses: fieldResponses,
        changed_fields: summarizeRevisionChanges(
          previous
            ? {
                status: previous.status,
                remarks: previous.remarks,
                corrective_action: previous.corrective_action,
                completion_signature: previous.completion_signature,
                completion_selfie: previous.completion_selfie,
                field_responses: previous.field_responses_snapshot,
              }
            : null,
          {
            status: revision.status,
            remarks: revision.remarks,
            corrective_action: revision.corrective_action,
            completion_signature: revision.completion_signature,
            completion_selfie: revision.completion_selfie,
            field_responses: revision.field_responses_snapshot,
          },
          revisionSnapshot
        ),
      } satisfies FormResponseRevision
    })
    .sort((a, b) => b.revision_number - a.revision_number)

  return {
    ...baseResponse,
    template_snapshot: templateSnapshot,
    field_responses: enrichFieldResponses(templateSnapshot, currentFieldResponses),
    revisions,
  }
}

async function fetchResponses(locationId: string, filters: FilterResponsesInput) {
  let query = supabase
    .from("form_responses")
    .select(`
      *,
      submitted_by:profiles!form_responses_submitted_by_profile_id_fkey(full_name),
      form_template:form_templates!form_responses_form_template_id_fkey(name, binder_id)
    `, { count: "exact" })
    .eq("location_id", locationId)
    .order("submitted_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (filters.form_template_id) query = query.eq("form_template_id", filters.form_template_id)
  if (filters.submitted_by_profile_id) query = query.eq("submitted_by_profile_id", filters.submitted_by_profile_id)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.overall_pass !== undefined) query = query.eq("overall_pass", filters.overall_pass)
  if (filters.from) query = query.gte("submitted_at", filters.from)
  if (filters.to) query = query.lte("submitted_at", `${filters.to}T23:59:59.999Z`)

  if (filters.binder_id && !filters.form_template_id) {
    const { data: templates } = await supabase
      .from("form_templates")
      .select("id")
      .eq("binder_id", filters.binder_id)

    if (templates && templates.length > 0) {
      const templateIds = templates.map((template: { id: string }) => template.id)
      query = query.in("form_template_id", templateIds)
    } else {
      return { responses: [] as FormResponse[], total: 0 }
    }
  }

  const { data, error, count } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  const responses = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    const base = mapResponseBaseRow(record)
    const templateSnapshot = normalizeTemplateSnapshot(record.template_snapshot) ?? {
      id: base.form_template_id,
      binder_id: "",
      location_id: locationId,
      name: base.form_template_name ?? "",
      description: null,
      instructions: null,
      frequency: null,
      regulatory_reference: null,
      retention_years: null,
      fields: [],
    }

    return {
      ...base,
      template_snapshot: templateSnapshot,
    }
  }) as FormResponse[]

  return { responses, total: count ?? 0 }
}

export async function listFormResponses(locationId: string, filters: FilterResponsesInput) {
  const getCached = unstable_cache(
    () => fetchResponses(locationId, filters),
    [
      "form-responses",
      locationId,
      JSON.stringify(filters),
    ],
    { revalidate: 30, tags: ["form-responses", `form-responses-${locationId}`] }
  )
  return getCached()
}

function responsesAreEqual(current: FormFieldResponse[], next: FormFieldResponse[]) {
  if (current.length !== next.length) return false
  for (let index = 0; index < current.length; index += 1) {
    if (current[index].form_field_id !== next[index].form_field_id) return false
    if (fieldResponseComparableValue(current[index]) !== fieldResponseComparableValue(next[index])) {
      return false
    }
  }
  return true
}

export async function updateFormResponse(
  locationId: string,
  responseId: string,
  input: UpdateFormResponseInput,
  editorProfileId: string
) {
  const responseRow = await getFormResponseRow(locationId, responseId)
  const existing = mapResponseBaseRow(responseRow)
  const templateSnapshot =
    normalizeTemplateSnapshot(responseRow.template_snapshot) ??
    await buildTemplateSnapshotForResponse(locationId, existing.form_template_id)

  const currentFieldResponses = await fetchCurrentFieldResponses(responseId)
  if (input.field_responses?.length) {
    validateFieldResponseIds(templateSnapshot, input.field_responses)
  }

  const nextFieldResponses = mergeFieldResponses(templateSnapshot, currentFieldResponses, input.field_responses)
  const nextStatus = input.status ?? existing.status
  const nextRemarks = input.remarks !== undefined ? input.remarks : existing.remarks
  const nextCorrectiveAction = input.corrective_action !== undefined
    ? input.corrective_action
    : existing.corrective_action
  const nextCompletionSignature = input.completion_signature !== undefined
    ? input.completion_signature
    : existing.completion_signature
  const nextCompletionSelfie = input.completion_selfie !== undefined
    ? input.completion_selfie
    : existing.completion_selfie
  const nextOverallPass = computeOverallPass(nextFieldResponses)

  const nothingChanged =
    nextStatus === existing.status &&
    (nextRemarks ?? null) === (existing.remarks ?? null) &&
    (nextCorrectiveAction ?? null) === (existing.corrective_action ?? null) &&
    (nextCompletionSignature ?? null) === (existing.completion_signature ?? null) &&
    (nextCompletionSelfie ?? null) === (existing.completion_selfie ?? null) &&
    nextOverallPass === existing.overall_pass &&
    responsesAreEqual(sortFieldResponsesBySnapshot(templateSnapshot, currentFieldResponses), nextFieldResponses)

  if (nothingChanged) {
    return getFormResponse(locationId, responseId)
  }

  const editedAt = new Date().toISOString()

  const { error } = await supabase.rpc("update_form_response_with_history", {
    p_response_id: responseId,
    p_location_id: locationId,
    p_editor_profile_id: editorProfileId,
    p_edited_at: editedAt,
    p_status: nextStatus,
    p_overall_pass: nextOverallPass,
    p_remarks: nextRemarks ?? null,
    p_corrective_action: nextCorrectiveAction ?? null,
    p_completion_signature: nextCompletionSignature ?? null,
    p_completion_selfie: nextCompletionSelfie ?? null,
    p_template_snapshot: templateSnapshot,
    p_field_responses: nextFieldResponses,
  })

  if (error) {
    throwMutationError(error, "Failed to update response")
  }

  revalidateResponsesCache(locationId)
  return getFormResponse(locationId, responseId)
}

export async function deleteFormResponse(locationId: string, responseId: string) {
  const { error } = await supabase
    .from("form_responses")
    .delete()
    .eq("id", responseId)
    .eq("location_id", locationId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  revalidateResponsesCache(locationId)
}
