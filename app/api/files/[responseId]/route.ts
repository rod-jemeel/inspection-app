import { NextRequest } from "next/server"
import { supabase } from "@/lib/server/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ responseId: string }> }
) {
  const { responseId } = await params
  const type = request.nextUrl.searchParams.get("type")

  if (!type || (type !== "signature" && type !== "selfie")) {
    return Response.json({ error: "Invalid type parameter" }, { status: 400 })
  }

  // Look up the form response
  const { data, error } = await supabase
    .from("form_responses")
    .select("completion_signature, completion_selfie")
    .eq("id", responseId)
    .single()

  if (error || !data) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const storagePath = (type === "signature" ? data.completion_signature : data.completion_selfie) as string | null
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
}
