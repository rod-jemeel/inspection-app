import { NextRequest } from "next/server"
import { requireFormEdit } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { updateFormFieldSchema } from "@/lib/validations/form-field"
import { getFormField, updateFormField, deleteFormField } from "@/lib/server/services/form-fields"
import { getFormTemplate } from "@/lib/server/services/form-templates"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string; fieldId: string }> }
) {
  try {
    const { locationId, formId, fieldId } = await params
    // Verify form template exists
    await getFormTemplate(locationId, formId)

    const field = await getFormField(fieldId)
    return Response.json(field)
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string; fieldId: string }> }
) {
  try {
    const { locationId, formId, fieldId } = await params
    const template = await getFormTemplate(locationId, formId)
    await requireFormEdit(locationId, template.binder_id)

    const body = await request.json()
    const parsed = updateFormFieldSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const field = await updateFormField(fieldId, parsed.data)
    return Response.json(field)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string; fieldId: string }> }
) {
  try {
    const { locationId, formId, fieldId } = await params
    const template = await getFormTemplate(locationId, formId)
    await requireFormEdit(locationId, template.binder_id)

    await deleteFormField(fieldId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleError(error)
  }
}
