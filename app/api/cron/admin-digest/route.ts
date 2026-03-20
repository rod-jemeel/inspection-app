import "server-only"
import { NextRequest } from "next/server"
import { supabase } from "@/lib/server/db"

/**
 * GET /api/cron/admin-digest
 *
 * Returns a structured summary of overdue and upcoming inspections
 * for all locations, intended for n8n to consume and email admins.
 *
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    // Fetch all pending/in_progress instances with joined data
    const { data: instances, error } = await supabase
      .from("inspection_instances")
      .select(`
        id,
        due_at,
        status,
        assigned_to_email,
        location_id,
        form_templates!form_template_id(name, frequency),
        locations(name)
      `)
      .in("status", ["pending", "in_progress"])
      .lte("due_at", sevenDaysFromNow.toISOString())
      .order("due_at", { ascending: true })
      .limit(200)

    if (error) {
      return Response.json({ error: "Failed to fetch instances" }, { status: 500 })
    }

    // Fetch all admin/owner profiles with emails for all locations
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["owner", "admin"])
      .not("email", "is", null)

    // Categorize instances
    const overdue: typeof instances = []
    const dueSoon: typeof instances = []

    for (const inst of instances ?? []) {
      const dueAt = new Date(inst.due_at)
      if (dueAt < now) {
        overdue.push(inst)
      } else {
        dueSoon.push(inst)
      }
    }

    // Format for n8n consumption
    const formatInstance = (inst: (typeof instances)[0]) => ({
      id: inst.id,
      task: (inst.form_templates as { name?: string } | null)?.name ?? "Inspection",
      location: (inst.locations as { name?: string } | null)?.name ?? "Unknown Location",
      due_at: inst.due_at,
      due_date_formatted: new Date(inst.due_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      days_overdue: daysOverdue(inst.due_at, now),
      status: inst.status,
      assigned_to: inst.assigned_to_email ?? "Unassigned",
      url: `/inspections/${inst.id}`,
    })

    return Response.json({
      generated_at: now.toISOString(),
      summary: {
        total_overdue: overdue.length,
        total_due_soon: dueSoon.length,
      },
      overdue: overdue.map(formatInstance),
      due_soon: dueSoon.map(formatInstance),
      admin_emails: (adminProfiles ?? [])
        .filter((p) => p.email)
        .map((p) => ({ email: p.email, name: p.full_name, role: p.role })),
    })
  } catch (err) {
    console.error("Admin digest error:", err)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}

function daysOverdue(dueAt: string, now: Date): number {
  const due = new Date(dueAt)
  if (due >= now) return 0
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}
