import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/server/services/templates"
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
    const { session } = await requireLocationAccess(locationId, ["admin", "owner"])

    const body = await request.json()
    const parsed = updateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    const template = await updateTemplate(locationId, templateId, session.user.id, parsed.data)
    return Response.json({ data: template })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; templateId: string }> }
) {
  try {
    const { locationId, templateId } = await params
    const { session } = await requireLocationAccess(locationId, ["admin", "owner"])

    await deleteTemplate(locationId, templateId, session.user.id)
    return Response.json({ success: true })
  } catch (error) {
    return handleError(error)
  }
}
