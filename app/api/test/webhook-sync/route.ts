import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, ApiError } from "@/lib/server/errors"
import { supabase } from "@/lib/server/db"
import { sendWebhookToN8n } from "@/lib/server/n8n/webhook-sender"
import { n8nConfig } from "@/lib/server/n8n/config"

export async function POST(request: NextRequest) {
  try {
    const { locationId, formTemplateId } = await request.json()
    if (!locationId || !formTemplateId) {
      throw new ApiError("VALIDATION_ERROR", "locationId and formTemplateId are required")
    }

    const { profile } = await requireLocationAccess(locationId)
    if (profile.role !== "owner" && !profile.can_manage_forms) {
      throw new ApiError("FORBIDDEN", "Only owners can use the test sync tool")
    }

    // Fetch form template + binder
    const { data: template, error: tErr } = await supabase
      .from("form_templates")
      .select("*, binders(name)")
      .eq("id", formTemplateId)
      .eq("location_id", locationId)
      .single()

    if (tErr || !template) throw new ApiError("NOT_FOUND", "Form template not found")
    if (!template.google_sheet_id) {
      throw new ApiError("VALIDATION_ERROR", "No Google Sheet ID configured on this form template")
    }

    // Fetch form fields for the template
    const { data: fields } = await supabase
      .from("form_fields")
      .select("id, label, field_type, options")
      .eq("form_template_id", formTemplateId)
      .eq("active", true)
      .order("sort_order", { ascending: true })

    // Build a mock record with placeholder values
    const record: Record<string, string> = {}
    const labelCounts = new Map<string, number>()
    for (const field of fields ?? []) {
      if (field.field_type === "section_header") continue
      const label = field.label.trim() || "Field"
      const count = (labelCounts.get(label) ?? 0) + 1
      labelCounts.set(label, count)
      const key = count === 1 ? label : `${label} ${count}`
      record[key] = `[TEST] ${field.label}`
    }

    const now = new Date().toISOString()
    const payload = {
      event: "form_response_submitted",
      operation: "submitted",
      timestamp: now,
      response_id: "test-" + Date.now(),
      revision_number: 1,
      form_template_id: formTemplateId,
      form_template_name: template.name,
      binder_name: (template.binders as { name: string } | null)?.name ?? null,
      location_id: locationId,
      submitted_at: now,
      original_submitted_at: now,
      last_edited_at: null,
      status: "complete",
      overall_pass: null,
      google_sheet_id: template.google_sheet_id,
      google_sheet_tab: template.google_sheet_tab,
      submitted_by: { profile_id: profile.id, name: profile.full_name },
      last_edited_by: null,
      record,
      media: { completion_signature: null, completion_selfie: null },
    }

    const webhookPath = n8nConfig.webhooks.formResponseSubmitted
    const result = await sendWebhookToN8n(webhookPath, payload)

    return Response.json({
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
      webhookUrl: `${n8nConfig.baseUrl}${webhookPath}`,
      payload,
    })
  } catch (error) {
    return handleError(error)
  }
}
