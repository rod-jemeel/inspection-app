import { NextRequest } from "next/server"
import { z } from "zod"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { reorderTemplates } from "@/lib/server/services/templates"
import { templateIdSchema } from "@/lib/validations/common"

const reorderSchema = z.object({
  frequency: z.enum(["weekly", "monthly", "yearly", "every_3_years"]),
  order: z.array(templateIdSchema),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId, ["admin", "owner"])

    const body = await request.json()
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    await reorderTemplates(locationId, parsed.data.frequency, parsed.data.order)
    return Response.json({ success: true })
  } catch (error) {
    return handleError(error)
  }
}
