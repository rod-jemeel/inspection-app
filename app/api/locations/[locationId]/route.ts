import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLocation, updateLocation } from "@/lib/server/services/locations"
import { updateLocationSchema } from "@/lib/validations/location"
import { ApiError } from "@/lib/server/errors"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId)

    const location = await getLocation(locationId)
    return Response.json({ data: location })
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId, ["admin", "owner"])

    const body = await request.json()
    const input = updateLocationSchema.parse(body)

    const location = await updateLocation(locationId, input)
    return Response.json({ data: location })
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
