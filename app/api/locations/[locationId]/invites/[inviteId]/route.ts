import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError } from "@/lib/server/errors"
import { supabase } from "@/lib/server/db"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; inviteId: string }> }
) {
  try {
    const { locationId, inviteId } = await params
    await requireLocationAccess(locationId, ["admin", "owner"])

    const { error } = await supabase
      .from("invite_codes")
      .delete()
      .eq("id", inviteId)
      .eq("location_id", locationId)

    if (error) {
      return Response.json(
        { error: { message: "Failed to revoke invite" } },
        { status: 500 }
      )
    }

    return Response.json({ success: true })
  } catch (error) {
    return handleError(error)
  }
}
