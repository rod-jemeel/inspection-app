import { NextRequest } from "next/server"
import { requireLocationAccess, requireBinderManagement } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { createBinderSchema } from "@/lib/validations/binder"
import { listBinders, createBinder, getBindersForUser } from "@/lib/server/services/binders"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    const { profile } = await requireLocationAccess(locationId)

    const binders = await getBindersForUser(locationId, profile.id, profile.role)
    return Response.json(binders)
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    const { profile } = await requireBinderManagement(locationId)

    const body = await request.json()
    const parsed = createBinderSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const binder = await createBinder(locationId, profile.id, parsed.data)
    return Response.json(binder, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
