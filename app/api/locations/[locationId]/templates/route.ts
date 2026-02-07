import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { listTemplates, createTemplate } from "@/lib/server/services/templates"
import { createTemplateSchema } from "@/lib/validations/template"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId)

    const url = new URL(request.url)
    const activeParam = url.searchParams.get("active")
    const active = activeParam === "true" ? true : activeParam === "false" ? false : undefined
    const binderId = url.searchParams.get("binder_id") || undefined

    const templates = await listTemplates(locationId, { active, binderId })
    return Response.json({ data: templates })
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
    const { session } = await requireLocationAccess(locationId, ["admin", "owner"])

    const body = await request.json()
    const parsed = createTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    const template = await createTemplate(locationId, session.user.id, parsed.data)
    return Response.json({ data: template }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
