import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, ApiError } from "@/lib/server/errors"
import { supabase } from "@/lib/server/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId)

    const path = request.nextUrl.searchParams.get("path")
    if (!path) throw new ApiError("VALIDATION_ERROR", "Missing path parameter")

    const bucket = process.env.SIGNATURES_BUCKET ?? "signatures"
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)

    if (error || !data) {
      throw new ApiError("INTERNAL_ERROR", "Failed to generate signed URL")
    }

    return Response.json({ url: data.signedUrl })
  } catch (error) {
    return handleError(error)
  }
}
