import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { listInviteCodes, createInviteCode } from "@/lib/server/services/invite-codes"
import { createInviteSchema } from "@/lib/validations/invite"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId, ["admin", "owner"])
    const invites = await listInviteCodes(locationId)
    return Response.json({ data: invites })
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
    const parsed = createInviteSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()
    const result = await createInviteCode(locationId, session.user.id, parsed.data)
    return Response.json({ data: result.invite, code: result.code }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
