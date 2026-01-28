import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { listInstances, createInstance } from "@/lib/server/services/instances"
import { appendEvent } from "@/lib/server/services/events"
import { createInstanceSchema, instanceFilterSchema } from "@/lib/validations/instance"
import { after } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId)

    const url = new URL(request.url)
    const filterInput = Object.fromEntries(url.searchParams.entries())
    const parsed = instanceFilterSchema.safeParse(filterInput)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    const instances = await listInstances(locationId, parsed.data)
    const nextCursor = instances.length === parsed.data.limit
      ? instances[instances.length - 1]?.due_at ?? null
      : null

    return Response.json({ data: instances, nextCursor })
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
    const { session, profile } = await requireLocationAccess(locationId, ["admin", "owner", "nurse"])

    const body = await request.json()
    const parsed = createInstanceSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    const instance = await createInstance(locationId, session.user.id, parsed.data)

    after(async () => {
      await appendEvent(instance.id, "created", profile.id, {
        template_id: parsed.data.template_id,
      })
    })

    return Response.json({ data: instance }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
