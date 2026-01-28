import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { getInstance, updateInstance } from "@/lib/server/services/instances"
import { appendEvent } from "@/lib/server/services/events"
import { updateInstanceSchema } from "@/lib/validations/instance"
import { after } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; instanceId: string }> }
) {
  try {
    const { locationId, instanceId } = await params
    await requireLocationAccess(locationId)

    const instance = await getInstance(locationId, instanceId)
    return Response.json({ data: instance })
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; instanceId: string }> }
) {
  try {
    const { locationId, instanceId } = await params
    const { profile } = await requireLocationAccess(locationId)

    const body = await request.json()
    const parsed = updateInstanceSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    const instance = await updateInstance(locationId, instanceId, parsed.data)

    if (parsed.data.status) {
      after(async () => {
        await appendEvent(instance.id, parsed.data.status!, profile.id, {
          remarks: parsed.data.remarks,
        })
      })
    }

    return Response.json({ data: instance })
  } catch (error) {
    return handleError(error)
  }
}
