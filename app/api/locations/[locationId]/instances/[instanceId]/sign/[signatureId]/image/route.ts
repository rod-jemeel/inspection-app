import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, ApiError } from "@/lib/server/errors"
import { getInstance } from "@/lib/server/services/instances"
import { supabase } from "@/lib/server/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; instanceId: string; signatureId: string }> }
) {
  try {
    const { locationId, instanceId, signatureId } = await params
    await requireLocationAccess(locationId)

    // Verify instance exists and belongs to location
    await getInstance(locationId, instanceId)

    // Get signature record
    const { data: signature, error: sigError } = await supabase
      .from("inspection_signatures")
      .select("signature_image_path")
      .eq("id", signatureId)
      .eq("inspection_instance_id", instanceId)
      .single()

    if (sigError || !signature) {
      throw new ApiError("NOT_FOUND", "Signature not found")
    }

    // Get signed URL for the image (valid for 1 hour)
    const bucket = process.env.SIGNATURES_BUCKET ?? "signatures"
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(signature.signature_image_path, 3600)

    if (urlError || !signedUrl) {
      throw new ApiError("INTERNAL_ERROR", "Failed to generate signature URL")
    }

    // Redirect to the signed URL
    return Response.redirect(signedUrl.signedUrl)
  } catch (error) {
    return handleError(error)
  }
}
