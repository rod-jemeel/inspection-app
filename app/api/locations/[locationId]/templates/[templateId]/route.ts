import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { getTemplate, updateTemplate } from "@/lib/server/services/templates"
import { updateTemplateSchema } from "@/lib/validations/template"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; templateId: string }> }
) {
  try {
    const { locationId, templateId } = await params
    await requireLocationAccess(locationId)

    const template = await getTemplate(locationId, templateId)
    return Response.json({ data: template })
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; templateId: string }> }
) {
  try {
    const { locationId, templateId } = await params
    await requireLocationAccess(locationId, ["admin", "owner"])

    const body = await request.json()
    const parsed = updateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    const template = await updateTemplate(locationId, templateId, parsed.data)
    return Response.json({ data: template })
  } catch (error) {
    return handleError(error)
  }
}
