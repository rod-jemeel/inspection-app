import { NextRequest, after } from "next/server"
import { canEditCompletedResponses, requireBinderAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { updateFormResponseSchema } from "@/lib/validations/form-response"
import {
  getFormResponse,
  updateFormResponse,
  deleteFormResponse,
  uploadFormImage,
} from "@/lib/server/services/form-responses"
import { getFormTemplate } from "@/lib/server/services/form-templates"
import { getBinder } from "@/lib/server/services/binders"
import { getLocation } from "@/lib/server/services/locations"
import { buildFormResponseSyncPayload } from "@/lib/server/n8n/form-response-sync"
import {
  notifyFormResponseCorrected,
  notifyFormResponseSubmitted,
} from "@/lib/server/n8n/webhook-sender"
import { ApiError } from "@/lib/server/errors"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; responseId: string }> }
) {
  try {
    const { locationId, responseId } = await params
    const response = await getFormResponse(locationId, responseId)
    const { profile } = await requireBinderAccess(locationId, response.template_snapshot.binder_id)
    const canEditResponse =
      canEditCompletedResponses(profile) ||
      (response.submitted_by_profile_id === profile.id && response.status === "draft")

    // Check if user can view this response
    if (!profile.can_view_all_responses && profile.role !== "owner") {
      if (response.submitted_by_profile_id !== profile.id) {
        throw new ApiError("FORBIDDEN", "You can only view your own responses")
      }
    }

    return Response.json({
      ...response,
      permissions: {
        can_edit_response: canEditResponse,
      },
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; responseId: string }> }
) {
  try {
    const { locationId, responseId } = await params
    // Get existing response to check ownership
    const existing = await getFormResponse(locationId, responseId)
    const { profile } = await requireBinderAccess(locationId, existing.template_snapshot.binder_id)
    const canManageCompletedResponse = canEditCompletedResponses(profile)

    if (!canManageCompletedResponse) {
      if (existing.submitted_by_profile_id !== profile.id) {
        throw new ApiError("FORBIDDEN", "You can only edit your own responses")
      }
      if (existing.status !== "draft") {
        throw new ApiError(
          "FORBIDDEN",
          "Completed records can only be corrected by admins or managers with elevated access"
        )
      }
    }

    const body = await request.json()
    const parsed = updateFormResponseSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    // Upload base64 images to storage (same pattern as POST)
    if (parsed.data.completion_signature?.startsWith("data:")) {
      parsed.data.completion_signature = await uploadFormImage(
        existing.form_template_id, profile.id, parsed.data.completion_signature, "signature"
      )
    }
    if (parsed.data.completion_selfie?.startsWith("data:")) {
      parsed.data.completion_selfie = await uploadFormImage(
        existing.form_template_id, profile.id, parsed.data.completion_selfie, "selfie"
      )
    }

    const response = await updateFormResponse(locationId, responseId, parsed.data, profile.id)

    if (response.status !== "draft") {
      const template = await getFormTemplate(locationId, response.form_template_id)

      if (template.google_sheet_id) {
        after(async () => {
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

          const operation = existing.status === "draft" ? "submitted" : "corrected"
          const payload = await buildFormResponseSyncPayload({
            operation,
            response,
            googleSheetId: template.google_sheet_id,
            googleSheetTab: template.google_sheet_tab,
            binderName,
            locationTimezone,
          })

          const notify = operation === "submitted"
            ? notifyFormResponseSubmitted(payload)
            : notifyFormResponseCorrected(payload)

          await notify.catch((err) => console.error("Google Sheets sync webhook failed:", err))
        })
      }
    }

    return Response.json(response)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; responseId: string }> }
) {
  try {
    const { locationId, responseId } = await params
    const existing = await getFormResponse(locationId, responseId)
    const { profile } = await requireBinderAccess(locationId, existing.template_snapshot.binder_id)

    if (!["owner", "admin"].includes(profile.role)) {
      throw new ApiError("ROLE_REQUIRED", "Role required: owner or admin")
    }

    await deleteFormResponse(locationId, responseId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleError(error)
  }
}
