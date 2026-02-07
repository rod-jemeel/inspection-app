import { NextRequest } from "next/server"
import { requireLocationAccess, requireFormEdit } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { createFormFieldSchema } from "@/lib/validations/form-field"
import { listFormFields, createFormField } from "@/lib/server/services/form-fields"
import { getFormTemplate } from "@/lib/server/services/form-templates"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string }> }
) {
  try {
    const { locationId, formId } = await params
    await requireLocationAccess(locationId)

    // Verify form template exists and belongs to this location
    await getFormTemplate(locationId, formId)

    const fields = await listFormFields(formId, { active: true })
    return Response.json(fields)
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
    const template = await getFormTemplate(locationId, formId)
    await requireFormEdit(locationId, template.binder_id)

    const body = await request.json()
    const parsed = createFormFieldSchema.safeParse({ ...body, form_template_id: formId })
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const field = await createFormField(parsed.data)
    return Response.json(field, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
