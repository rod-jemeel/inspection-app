import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { updateMemberRole, removeMemberFromLocation, updateMemberPermissions } from "@/lib/server/services/locations"
import { updateMemberSchema } from "@/lib/validations/location"
import { ApiError } from "@/lib/server/errors"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ locationId: string; profileId: string }> }
) {
  try {
    const { locationId, profileId } = await params
    const { profile } = await requireLocationAccess(locationId, ["admin", "owner"])

    if (profile.id === profileId) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Cannot change your own settings" } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const input = updateMemberSchema.parse(body)

    if (input.role) {
      await updateMemberRole(locationId, profileId, input.role)
    }
    if (input.permissions) {
      await updateMemberPermissions(locationId, profileId, input.permissions)
    }

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status }
      )
    }
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "An error occurred" } },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ locationId: string; profileId: string }> }
) {
  try {
    const { locationId, profileId } = await params
    const { profile } = await requireLocationAccess(locationId, ["admin", "owner"])

    // Can't remove yourself
    if (profile.id === profileId) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Cannot remove yourself from location" } },
        { status: 403 }
      )
    }

    await removeMemberFromLocation(locationId, profileId)
    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status }
      )
    }
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "An error occurred" } },
      { status: 500 }
    )
  }
}
