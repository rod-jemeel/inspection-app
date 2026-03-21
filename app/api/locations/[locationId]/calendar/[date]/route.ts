import { NextRequest, NextResponse } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { supabase } from "@/lib/server/db"
import { ApiError, handleError } from "@/lib/server/errors"

/**
 * GET /api/locations/:locationId/calendar/:date
 *
 * Fetches all inspection events for a specific date.
 * Used by calendar modal to show detailed event list without page navigation.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; date: string }> }
) {
  try {
    const { locationId, date } = await params

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ApiError("VALIDATION_ERROR", "Invalid date format. Use YYYY-MM-DD")
    }

    const { profile } = await requireLocationAccess(locationId)

    // Role-based filtering — only external inspectors are filtered by email
    const isInspector = profile.role === "inspector"
    const inspectorEmail = isInspector ? profile.email : null

    const startOfDay = `${date}T00:00:00.000Z`
    const endOfDay = `${date}T23:59:59.999Z`

    let query = supabase
      .from("inspection_instances")
      .select(`
        id,
        due_at,
        status,
        assigned_to_email,
        assigned_to_profile_id,
        passed_at,
        failed_at,
        form_templates!form_template_id(name, description, frequency),
        profiles!assigned_to_profile_id(full_name)
      `)
      .eq("location_id", locationId)
      .gte("due_at", startOfDay)
      .lte("due_at", endOfDay)
      .neq("status", "void")
      .order("due_at", { ascending: true })

    if (inspectorEmail) {
      query = query.eq("assigned_to_email", inspectorEmail)
    }

    const { data: queryData, error: queryError } = await query

    if (queryError) {
      throw new ApiError("INTERNAL_ERROR", queryError.message)
    }

    const events = (queryData ?? []).map((row: Record<string, unknown>) => {
      const template = row.form_templates as { name?: string; description?: string | null; frequency?: string } | null
      const assigneeProfile = row.profiles as { full_name?: string } | null
      const assigneeName = assigneeProfile?.full_name ?? (row.assigned_to_email as string | null) ?? null
      return {
        id: row.id,
        task: template?.name ?? "Inspection",
        description: template?.description ?? null,
        dueAt: row.due_at,
        status: row.status,
        assignee: assigneeName,
        frequency: template?.frequency ?? null,
        passedAt: row.passed_at,
        failedAt: row.failed_at,
      }
    })

    return NextResponse.json({ events, date })
  } catch (err) {
    return handleError(err)
  }
}
