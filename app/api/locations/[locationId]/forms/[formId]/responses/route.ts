import { NextRequest, after } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { submitFormResponseSchema, filterResponsesSchema } from "@/lib/validations/form-response"
import { submitFormResponse, listFormResponses, uploadFormImage, getFormImageUrl } from "@/lib/server/services/form-responses"
import { getFormTemplate } from "@/lib/server/services/form-templates"
import { getBinder } from "@/lib/server/services/binders"
import { notifyFormResponseSubmitted } from "@/lib/server/n8n/webhook-sender"
import { supabase } from "@/lib/server/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string }> }
) {
  try {
    const { locationId, formId } = await params
    const { profile } = await requireLocationAccess(locationId)

    // Verify form template exists
    await getFormTemplate(locationId, formId)

    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parsed = filterResponsesSchema.safeParse({ ...searchParams, form_template_id: formId })
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    // If user can't view all responses, filter to their own
    const filters = parsed.data
    if (!profile.can_view_all_responses && profile.role !== "owner") {
      filters.submitted_by_profile_id = profile.id
    }

    const result = await listFormResponses(locationId, filters)
    return Response.json(result)
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string }> }
) {
  try {
    const { locationId, formId } = await params
    const { profile } = await requireLocationAccess(locationId)

    // Verify form template exists and get sheet config
    const template = await getFormTemplate(locationId, formId)

    const body = await request.json()
    const parsed = submitFormResponseSchema.safeParse({ ...body, form_template_id: formId })
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    // Upload completion images to Supabase Storage (replace base64 with paths)
    if (parsed.data.completion_signature?.startsWith("data:")) {
      parsed.data.completion_signature = await uploadFormImage(
        formId, profile.id, parsed.data.completion_signature, "signature"
      )
    }
    if (parsed.data.completion_selfie?.startsWith("data:")) {
      parsed.data.completion_selfie = await uploadFormImage(
        formId, profile.id, parsed.data.completion_selfie, "selfie"
      )
    }

    const response = await submitFormResponse(locationId, profile.id, parsed.data)

    // Fire-and-forget: sync to Google Sheets via n8n
    if (template.google_sheet_id) {
      after(async () => {
        // Fetch field labels for the response
        const { data: fieldData } = await supabase
          .from("form_fields")
          .select("id, label, field_type, sheet_header")
          .eq("form_template_id", formId)
          .order("sort_order", { ascending: true })

        const fieldMap = new Map(
          (fieldData ?? []).map((f: { id: string; label: string; field_type: string; sheet_header: string | null }) => [f.id, f])
        )

        // Get binder name
        let binderName: string | null = null
        try {
          const binder = await getBinder(locationId, template.binder_id)
          binderName = binder.name
        } catch { /* ignore */ }

        // Build flat field responses for the sheet (skip section_header fields)
        const fieldResponses = response.field_responses
          .filter((fr) => {
            const field = fieldMap.get(fr.form_field_id)
            return field?.field_type !== "section_header"
          })
          .map((fr) => {
            const field = fieldMap.get(fr.form_field_id)
            const value = fr.value_text ?? fr.value_number ?? fr.value_boolean ?? fr.value_date ?? fr.value_datetime ?? null
            return {
              label: field?.label ?? "Unknown",
              field_type: field?.field_type ?? "text",
              sheet_header: field?.sheet_header ?? null,
              value,
            }
          })

        // Generate short redirect URLs for the webhook
        const signatureUrl = response.completion_signature
          ? getFormImageUrl(response.id, "signature")
          : null
        const selfieUrl = response.completion_selfie
          ? getFormImageUrl(response.id, "selfie")
          : null

        await notifyFormResponseSubmitted({
          event: "form_response_submitted",
          timestamp: new Date().toISOString(),
          response_id: response.id,
          form_template_id: formId,
          form_template_name: template.name,
          binder_name: binderName,
          location_id: locationId,
          submitted_by_profile_id: profile.id,
          submitted_by_name: profile.full_name ?? null,
          status: response.status,
          overall_pass: response.overall_pass,
          completion_signature: signatureUrl,
          completion_selfie: selfieUrl,
          google_sheet_id: template.google_sheet_id,
          google_sheet_tab: template.google_sheet_tab,
          field_responses: fieldResponses,
        }).catch((err) => console.error("Google Sheets sync webhook failed:", err))
      })
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
