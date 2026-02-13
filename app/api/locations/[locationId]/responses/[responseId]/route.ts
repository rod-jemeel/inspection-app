import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { updateFormResponseSchema } from "@/lib/validations/form-response"
import {
  getFormResponse,
  updateFormResponse,
  deleteFormResponse,
  uploadFormImage,
} from "@/lib/server/services/form-responses"
import { ApiError } from "@/lib/server/errors"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; responseId: string }> }
) {
  try {
    const { locationId, responseId } = await params
    const { profile } = await requireLocationAccess(locationId)

    const response = await getFormResponse(locationId, responseId)

    // Check if user can view this response
    if (!profile.can_view_all_responses && profile.role !== "owner") {
      if (response.submitted_by_profile_id !== profile.id) {
        throw new ApiError("FORBIDDEN", "You can only view your own responses")
      }
    }

    return Response.json(response)
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
    const { profile } = await requireLocationAccess(locationId)

    // Get existing response to check ownership
    const existing = await getFormResponse(locationId, responseId)

    // Users can only update their own draft responses, unless they have view_all permission
    if (!profile.can_view_all_responses && profile.role !== "owner") {
      if (existing.submitted_by_profile_id !== profile.id) {
        throw new ApiError("FORBIDDEN", "You can only edit your own responses")
      }
      if (existing.status !== "draft") {
        throw new ApiError("VALIDATION_ERROR", "Only draft responses can be edited")
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

    const response = await updateFormResponse(locationId, responseId, parsed.data)
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
    const { profile } = await requireLocationAccess(locationId, ["owner", "admin"])

    await deleteFormResponse(locationId, responseId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleError(error)
  }
}
