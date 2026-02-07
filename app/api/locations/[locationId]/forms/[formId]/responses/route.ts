import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { submitFormResponseSchema, filterResponsesSchema } from "@/lib/validations/form-response"
import { submitFormResponse, listFormResponses } from "@/lib/server/services/form-responses"
import { getFormTemplate } from "@/lib/server/services/form-templates"

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

    // Verify form template exists
    await getFormTemplate(locationId, formId)

    const body = await request.json()
    const parsed = submitFormResponseSchema.safeParse({ ...body, form_template_id: formId })
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const response = await submitFormResponse(locationId, profile.id, parsed.data)
    return Response.json(response, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
