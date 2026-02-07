import { NextRequest } from "next/server"
import { requireFormEdit } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { reorderFieldsSchema } from "@/lib/validations/form-field"
import { reorderFormFields } from "@/lib/server/services/form-fields"
import { getFormTemplate } from "@/lib/server/services/form-templates"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; formId: string }> }
) {
  try {
    const { locationId, formId } = await params
    const template = await getFormTemplate(locationId, formId)
    await requireFormEdit(locationId, template.binder_id)

    const body = await request.json()
    const parsed = reorderFieldsSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    await reorderFormFields(formId, parsed.data)
    return Response.json({ success: true })
  } catch (error) {
    return handleError(error)
  }
}
