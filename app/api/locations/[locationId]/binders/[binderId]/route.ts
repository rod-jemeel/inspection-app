import { NextRequest } from "next/server"
import { requireLocationAccess, requireBinderManagement } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { updateBinderSchema } from "@/lib/validations/binder"
import { getBinder, updateBinder, deleteBinder } from "@/lib/server/services/binders"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; binderId: string }> }
) {
  try {
    const { locationId, binderId } = await params
    await requireLocationAccess(locationId)

    const binder = await getBinder(locationId, binderId)
    return Response.json(binder)
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; binderId: string }> }
) {
  try {
    const { locationId, binderId } = await params
    await requireBinderManagement(locationId)

    const body = await request.json()
    const parsed = updateBinderSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const binder = await updateBinder(locationId, binderId, parsed.data)
    return Response.json(binder)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; binderId: string }> }
) {
  try {
    const { locationId, binderId } = await params
    await requireBinderManagement(locationId)

    await deleteBinder(locationId, binderId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleError(error)
  }
}
