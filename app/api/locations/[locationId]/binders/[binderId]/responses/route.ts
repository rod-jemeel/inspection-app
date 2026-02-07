import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { filterResponsesSchema } from "@/lib/validations/form-response"
import { listFormResponses } from "@/lib/server/services/form-responses"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; binderId: string }> }
) {
  try {
    const { locationId, binderId } = await params
    const { profile } = await requireLocationAccess(locationId)

    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parsed = filterResponsesSchema.safeParse({
      ...searchParams,
      binder_id: binderId
    })
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
