import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"

export interface Signature {
  id: string
  inspection_instance_id: string
  signed_by_profile_id: string
  signed_at: string
  signature_image_path: string
  signature_points: unknown | null
  device_meta: Record<string, unknown> | null
}

export async function getSignatures(instanceId: string) {
  const { data, error } = await supabase
    .from("inspection_signatures")
    .select("*")
    .eq("inspection_instance_id", instanceId)
    .order("signed_at", { ascending: true })

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as Signature[]
}

export async function createSignature(input: {
  inspection_instance_id: string
  signed_by_profile_id: string
  signature_image_path: string
  signature_points?: unknown
  device_meta?: Record<string, unknown>
}) {
  // Check for existing signature from same profile
  const { data: existing } = await supabase
    .from("inspection_signatures")
    .select("id")
    .eq("inspection_instance_id", input.inspection_instance_id)
    .eq("signed_by_profile_id", input.signed_by_profile_id)
    .single()

  if (existing) {
    throw new ApiError("ALREADY_SIGNED", "This instance has already been signed by this user")
  }

  const { data, error } = await supabase
    .from("inspection_signatures")
    .insert(input)
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as Signature
}

export async function uploadSignatureImage(
  instanceId: string,
  profileId: string,
  imageBuffer: ArrayBuffer
) {
  const bucket = process.env.SIGNATURES_BUCKET ?? "signatures"
  const path = `${instanceId}/${profileId}-${Date.now()}.png`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, imageBuffer, {
      contentType: "image/png",
      upsert: false,
    })

  if (error) throw new ApiError("INTERNAL_ERROR", `Signature upload failed: ${error.message}`)
  return path
}
