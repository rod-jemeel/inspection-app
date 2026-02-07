import { NextRequest } from "next/server"
import { requireLocationAccess, requireFormEdit } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { updateFormTemplateSchema } from "@/lib/validations/form-template"
import {
  getFormTemplate,
  updateFormTemplate,
  deleteFormTemplate,
} from "@/lib/server/services/form-templates"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string }> }
) {
  try {
    const { locationId, formId } = await params
    await requireLocationAccess(locationId)

    const template = await getFormTemplate(locationId, formId)
    return Response.json(template)
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string }> }
) {
  try {
    const { locationId, formId } = await params
    const template = await getFormTemplate(locationId, formId)
    await requireFormEdit(locationId, template.binder_id)

    const body = await request.json()
    const parsed = updateFormTemplateSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const updated = await updateFormTemplate(locationId, formId, parsed.data)
    return Response.json(updated)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string }> }
) {
  try {
    const { locationId, formId } = await params
    const template = await getFormTemplate(locationId, formId)
    await requireFormEdit(locationId, template.binder_id)

    await deleteFormTemplate(locationId, formId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleError(error)
  }
}
