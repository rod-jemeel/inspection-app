import "server-only"
import sharp from "sharp"
import { unstable_cache, revalidateTag } from "next/cache"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
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
export function getFormImageUrl(responseId: string, type: "signature" | "selfie"): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${baseUrl}/api/files/${responseId}?type=${type}`
}

function revalidateResponsesCache(locationId: string) {
  revalidateTag("form-responses", "max")
  revalidateTag(`form-responses-${locationId}`, "max")
}

export interface FormResponse {
  id: string
  form_template_id: string
  location_id: string
  inspection_instance_id: string | null
  submitted_by_profile_id: string
  submitted_at: string
  status: "draft" | "complete" | "flagged"
  overall_pass: boolean | null
  remarks: string | null
  corrective_action: string | null
  completion_signature: string | null
  completion_selfie: string | null
  created_at: string
  updated_at: string
  // Enriched fields
  submitted_by_name?: string | null
  form_template_name?: string | null
  binder_name?: string | null
}

export interface FormFieldResponse {
  id: string
  form_response_id: string
  form_field_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: Record<string, unknown> | null
  attachment_url: string | null
  pass: boolean | null
  created_at: string
  updated_at: string
}

export interface FormResponseWithFields extends FormResponse {
  field_responses: FormFieldResponse[]
}

export async function submitFormResponse(
  locationId: string,
  profileId: string,
  input: SubmitFormResponseInput
): Promise<FormResponseWithFields> {
  // Compute overall_pass from field responses
  const fieldPassValues = input.field_responses
    .map((fr) => fr.pass)
    .filter((p): p is boolean => p !== undefined)
  const overall_pass = fieldPassValues.length > 0
    ? fieldPassValues.every((p) => p === true)
    : null

  // Insert form response
  const { data: response, error: responseError } = await supabase
    .from("form_responses")
    .insert({
      form_template_id: input.form_template_id,
      location_id: locationId,
      inspection_instance_id: input.inspection_instance_id ?? null,
      submitted_by_profile_id: profileId,
      status: input.status,
      overall_pass,
      remarks: input.remarks ?? null,
      corrective_action: input.corrective_action ?? null,
      completion_signature: input.completion_signature ?? null,
      completion_selfie: input.completion_selfie ?? null,
    })
    .select()
    .single()

  if (responseError) throw new ApiError("INTERNAL_ERROR", responseError.message)

  // Insert field responses
  const fieldRows = input.field_responses.map((fr: FieldResponseInput) => ({
    form_response_id: response.id,
    form_field_id: fr.form_field_id,
    value_text: fr.value_text ?? null,
    value_number: fr.value_number ?? null,
    value_boolean: fr.value_boolean ?? null,
    value_date: fr.value_date ?? null,
    value_datetime: fr.value_datetime ?? null,
    value_json: fr.value_json ?? null,
    attachment_url: fr.attachment_url ?? null,
    pass: fr.pass ?? null,
  }))

  const { data: fieldResponses, error: fieldError } = await supabase
    .from("form_field_responses")
    .insert(fieldRows)
    .select()

  if (fieldError) throw new ApiError("INTERNAL_ERROR", fieldError.message)

  revalidateResponsesCache(locationId)

  return {
    ...(response as FormResponse),
    field_responses: (fieldResponses ?? []) as FormFieldResponse[],
  }
}

export async function getFormResponse(
  locationId: string,
  responseId: string
): Promise<FormResponseWithFields> {
  const { data: response, error } = await supabase
    .from("form_responses")
    .select(`
      *,
      submitted_by:profiles!form_responses_submitted_by_profile_id_fkey(full_name),
      form_template:form_templates!form_responses_form_template_id_fkey(name, binder_id)
    `)
    .eq("id", responseId)
    .eq("location_id", locationId)
    .single()

  if (error || !response) throw new ApiError("NOT_FOUND", "Form response not found")

  // Get field responses with field labels
  const { data: fieldResponses, error: frError } = await supabase
    .from("form_field_responses")
    .select(`
      *,
      form_field:form_fields!form_field_responses_form_field_id_fkey(label, field_type, sort_order)
    `)
    .eq("form_response_id", responseId)
    .order("created_at", { ascending: true })

  if (frError) throw new ApiError("INTERNAL_ERROR", frError.message)

  const row = response as Record<string, unknown>
  const submittedBy = row.submitted_by as { full_name: string } | null
  const formTemplate = row.form_template as { name: string; binder_id: string } | null

  return {
    id: row.id as string,
    form_template_id: row.form_template_id as string,
    location_id: row.location_id as string,
    inspection_instance_id: row.inspection_instance_id as string | null,
    submitted_by_profile_id: row.submitted_by_profile_id as string,
    submitted_at: row.submitted_at as string,
    status: row.status as "draft" | "complete" | "flagged",
    overall_pass: row.overall_pass as boolean | null,
    remarks: row.remarks as string | null,
    corrective_action: row.corrective_action as string | null,
    completion_signature: row.completion_signature as string | null,
    completion_selfie: row.completion_selfie as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    submitted_by_name: submittedBy?.full_name ?? null,
    form_template_name: formTemplate?.name ?? null,
    field_responses: (fieldResponses ?? []) as FormFieldResponse[],
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
  if (filters.to) query = query.lte("submitted_at", filters.to + "T23:59:59.999Z")

  // Filter by binder_id via form_template join
  if (filters.binder_id) {
    // Get form template IDs for this binder first
    const { data: templates } = await supabase
      .from("form_templates")
      .select("id")
      .eq("binder_id", filters.binder_id)

    if (templates && templates.length > 0) {
      const templateIds = templates.map((t: { id: string }) => t.id)
      query = query.in("form_template_id", templateIds)
    } else {
      return { responses: [] as FormResponse[], total: 0 }
    }
  }

  const { data, error, count } = await query
  if (error) throw new ApiError("INTERNAL_ERROR", error.message)

  const responses = (data ?? []).map((row: Record<string, unknown>) => {
    const submittedBy = row.submitted_by as { full_name: string } | null
    const formTemplate = row.form_template as { name: string; binder_id: string } | null
    return {
      ...row,
      submitted_by: undefined,
      form_template: undefined,
      submitted_by_name: submittedBy?.full_name ?? null,
      form_template_name: formTemplate?.name ?? null,
    }
  }) as unknown as FormResponse[]

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

export async function updateFormResponse(
  locationId: string,
  responseId: string,
  input: UpdateFormResponseInput
) {
  const updates: Record<string, unknown> = {}
  if (input.status !== undefined) updates.status = input.status
  if (input.remarks !== undefined) updates.remarks = input.remarks
  if (input.corrective_action !== undefined) updates.corrective_action = input.corrective_action
  if (input.completion_signature !== undefined) updates.completion_signature = input.completion_signature
  if (input.completion_selfie !== undefined) updates.completion_selfie = input.completion_selfie

  const { data, error } = await supabase
    .from("form_responses")
    .update(updates)
    .eq("id", responseId)
    .eq("location_id", locationId)
    .select()
    .single()

  if (error || !data) throw new ApiError("NOT_FOUND", "Form response not found")

  // Update field responses if provided
  if (input.field_responses && input.field_responses.length > 0) {
    for (const fr of input.field_responses) {
      await supabase
        .from("form_field_responses")
        .upsert(
          {
            form_response_id: responseId,
            form_field_id: fr.form_field_id,
            value_text: fr.value_text ?? null,
            value_number: fr.value_number ?? null,
            value_boolean: fr.value_boolean ?? null,
            value_date: fr.value_date ?? null,
            value_datetime: fr.value_datetime ?? null,
            value_json: fr.value_json ?? null,
            attachment_url: fr.attachment_url ?? null,
            pass: fr.pass ?? null,
          },
          { onConflict: "form_response_id,form_field_id" }
        )
    }

    // Recompute overall_pass
    const { data: allFieldResponses } = await supabase
      .from("form_field_responses")
      .select("pass")
      .eq("form_response_id", responseId)

    const passValues = (allFieldResponses ?? [])
      .map((r: { pass: boolean | null }) => r.pass)
      .filter((p): p is boolean => p !== null)

    const overall_pass = passValues.length > 0 ? passValues.every((p) => p) : null

    await supabase
      .from("form_responses")
      .update({ overall_pass })
      .eq("id", responseId)
  }

  revalidateResponsesCache(locationId)
  return data as FormResponse
}

export async function deleteFormResponse(locationId: string, responseId: string) {
  // Hard delete (cascade will remove field_responses)
  const { error } = await supabase
    .from("form_responses")
    .delete()
    .eq("id", responseId)
    .eq("location_id", locationId)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  revalidateResponsesCache(locationId)
}
