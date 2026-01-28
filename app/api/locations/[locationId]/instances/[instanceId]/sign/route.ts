import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError } from "@/lib/server/errors"
import { getInstance } from "@/lib/server/services/instances"
import { createSignature, uploadSignatureImage } from "@/lib/server/services/signatures"
import { appendEvent } from "@/lib/server/services/events"
import { after } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; instanceId: string }> }
) {
  try {
    const { locationId, instanceId } = await params
    const { profile } = await requireLocationAccess(locationId)

    // Verify instance exists and belongs to location
    await getInstance(locationId, instanceId)

    // Get signature image from form data
    const formData = await request.formData()
    const signatureFile = formData.get("signature") as File | null
    const signaturePoints = formData.get("points") as string | null
    const deviceMeta = formData.get("deviceMeta") as string | null

    if (!signatureFile) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Signature image is required" } },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const imageBuffer = await signatureFile.arrayBuffer()
    const imagePath = await uploadSignatureImage(instanceId, profile.id, imageBuffer)

    // Create signature record
    const signature = await createSignature({
      inspection_instance_id: instanceId,
      signed_by_profile_id: profile.id,
      signature_image_path: imagePath,
      signature_points: signaturePoints ? JSON.parse(signaturePoints) : null,
      device_meta: deviceMeta ? JSON.parse(deviceMeta) : null,
    })

    after(async () => {
      await appendEvent(instanceId, "signed", profile.id, {
        signature_id: signature.id,
      })
    })

    return Response.json({ data: signature }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
