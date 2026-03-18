import { NextRequest } from "next/server"
import { requireBinderAccess } from "@/lib/server/auth-helpers"
import { supabase } from "@/lib/server/db"
import { handleError } from "@/lib/server/errors"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ responseId: string }> }
) {
  try {
  const { responseId } = await params
  const type = request.nextUrl.searchParams.get("type")
  const revisionParam = request.nextUrl.searchParams.get("revision")
  const revisionNumber = revisionParam ? Number(revisionParam) : null

  if (!type || (type !== "signature" && type !== "selfie")) {
    return Response.json({ error: "Invalid type parameter" }, { status: 400 })
  }
  if (revisionParam && (!revisionNumber || Number.isNaN(revisionNumber))) {
    return Response.json({ error: "Invalid revision parameter" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("form_responses")
    .select("location_id, template_snapshot, completion_signature, completion_selfie")
    .eq("id", responseId)
    .single()

  if (error || !data) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const snapshot = (data.template_snapshot ?? null) as { binder_id?: string } | null
  if (!snapshot?.binder_id) {
    return Response.json({ error: "Form snapshot missing binder reference" }, { status: 500 })
  }

  await requireBinderAccess(String(data.location_id), snapshot.binder_id)

  let storagePath = (type === "signature" ? data.completion_signature : data.completion_selfie) as string | null
  if (revisionNumber) {
    const { data: revisionData, error: revisionError } = await supabase
      .from("form_response_revisions")
      .select("completion_signature, completion_selfie")
      .eq("form_response_id", responseId)
      .eq("revision_number", revisionNumber)
      .single()

    if (revisionError || !revisionData) {
      return Response.json({ error: "Revision not found" }, { status: 404 })
    }

    storagePath = (type === "signature"
      ? revisionData.completion_signature
      : revisionData.completion_selfie) as string | null
  }

  if (!storagePath) {
    return Response.json({ error: "No file available" }, { status: 404 })
  }

  // Create a short-lived signed URL (5 minutes)
  const bucket = process.env.SIGNATURES_BUCKET ?? "signatures"
  const { data: signedData, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 300)

  if (signError || !signedData?.signedUrl) {
    return Response.json({ error: "Failed to generate URL" }, { status: 500 })
  }

  // Redirect to the signed URL
  return Response.redirect(signedData.signedUrl, 302)
  } catch (err) {
    return handleError(err)
  }
}
