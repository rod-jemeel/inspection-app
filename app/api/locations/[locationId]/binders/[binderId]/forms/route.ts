import { NextRequest } from "next/server"
import { requireLocationAccess, requireFormEdit } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { createFormTemplateSchema } from "@/lib/validations/form-template"
import { listFormTemplates, createFormTemplate } from "@/lib/server/services/form-templates"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; binderId: string }> }
) {
  try {
    const { locationId, binderId } = await params
    await requireLocationAccess(locationId)

    const templates = await listFormTemplates(locationId, binderId, { active: true })
    return Response.json(templates)
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; binderId: string }> }
) {
  try {
    const { locationId, binderId } = await params
    const { profile } = await requireFormEdit(locationId, binderId)

    const body = await request.json()
    const parsed = createFormTemplateSchema.safeParse({ ...body, binder_id: binderId })
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const template = await createFormTemplate(locationId, profile.id, parsed.data)
    return Response.json(template, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
