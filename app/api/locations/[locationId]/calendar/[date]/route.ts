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

    // Role-based filtering
    const isInspector = profile.role === "inspector" || profile.role === "nurse"
    const inspectorEmail = isInspector ? profile.email : null

    // Use RPC function if available, otherwise fallback to direct query
    const { data, error } = await supabase.rpc("get_events_for_date", {
      p_location_id: locationId,
      p_date: date,
      p_inspector_email: inspectorEmail,
    })

    if (error) {
      // Fallback to direct query if RPC doesn't exist
      if (error.code === "42883") { // function does not exist
        const startOfDay = `${date}T00:00:00.000Z`
        const endOfDay = `${date}T23:59:59.999Z`

        let query = supabase
          .from("inspection_instances")
          .select(`
            id,
            due_at,
            status,
            assigned_to_email,
            passed_at,
            failed_at,
            inspection_templates(task, description, frequency)
          `)
          .eq("location_id", locationId)
          .gte("due_at", startOfDay)
          .lte("due_at", endOfDay)
          .neq("status", "void")
          .order("due_at", { ascending: true })

        if (inspectorEmail) {
          query = query.eq("assigned_to_email", inspectorEmail)
        }

        const { data: fallbackData, error: fallbackError } = await query

        if (fallbackError) {
          throw new ApiError("INTERNAL_ERROR", fallbackError.message)
        }

        // Transform to expected format
        const events = (fallbackData ?? []).map((row: Record<string, unknown>) => {
          const template = row.inspection_templates as { task?: string; description?: string | null; frequency?: string } | null
          return {
            id: row.id,
            task: template?.task ?? "Inspection",
            description: template?.description ?? null,
            dueAt: row.due_at,
            status: row.status,
            assignee: row.assigned_to_email,
            frequency: template?.frequency ?? null,
            passedAt: row.passed_at,
            failedAt: row.failed_at,
          }
        })

        return NextResponse.json({ events, date })
      }
      throw new ApiError("INTERNAL_ERROR", error.message)
    }

    return NextResponse.json({ events: data ?? [], date })
  } catch (err) {
    return handleError(err)
  }
}
