import { NextRequest } from "next/server"
import { requireBinderManagement } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { updateBinderAssignmentsSchema } from "@/lib/validations/binder"
import { getBinderAssignments, updateBinderAssignments } from "@/lib/server/services/binders"
import { getBinder } from "@/lib/server/services/binders"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; binderId: string }> }
) {
  try {
    const { locationId, binderId } = await params
    await requireBinderManagement(locationId)

    // Verify binder exists
    await getBinder(locationId, binderId)

    const assignments = await getBinderAssignments(binderId)
    return Response.json(assignments)
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; binderId: string }> }
) {
  try {
    const { locationId, binderId } = await params
    const { profile } = await requireBinderManagement(locationId)

    // Verify binder exists
    await getBinder(locationId, binderId)

    const body = await request.json()
    const parsed = updateBinderAssignmentsSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const assignments = await updateBinderAssignments(binderId, parsed.data, profile.id)
    return Response.json(assignments)
  } catch (error) {
    return handleError(error)
  }
}
