import { NextRequest, after } from "next/server"
import { requireBinderAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { submitFormResponseSchema, filterResponsesSchema } from "@/lib/validations/form-response"
import { submitFormResponse, listFormResponses, uploadFormImage } from "@/lib/server/services/form-responses"
import { getFormTemplate } from "@/lib/server/services/form-templates"
import { getBinder } from "@/lib/server/services/binders"
import { getLocation } from "@/lib/server/services/locations"
import { notifyFormResponseSubmitted } from "@/lib/server/n8n/webhook-sender"
import { buildFormResponseSyncPayload } from "@/lib/server/n8n/form-response-sync"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string }> }
) {
  try {
    const { locationId, formId } = await params
    const template = await getFormTemplate(locationId, formId)
    const { profile } = await requireBinderAccess(locationId, template.binder_id)

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
    const template = await getFormTemplate(locationId, formId)
    const { profile } = await requireBinderAccess(locationId, template.binder_id)

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

    // Fire-and-forget: sync only completed/flagged records to Google Sheets
    if (template.google_sheet_id && response.status !== "draft") {
      after(async () => {
        // Get binder name
        let binderName: string | null = null
        let locationTimezone: string | null = null
        try {
          const [binder, location] = await Promise.all([
            getBinder(locationId, template.binder_id),
            getLocation(locationId),
          ])
          binderName = binder.name
          locationTimezone = location.timezone ?? null
        } catch { /* ignore */ }

        const payload = await buildFormResponseSyncPayload({
          operation: "submitted",
          response,
          googleSheetId: template.google_sheet_id,
          googleSheetTab: template.google_sheet_tab,
          binderName,
          locationTimezone,
        })
        await notifyFormResponseSubmitted(payload).catch((err) => console.error("Google Sheets sync webhook failed:", err))
      })
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
