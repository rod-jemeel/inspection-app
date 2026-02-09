import "server-only"
import { verifyN8nRequest } from "@/lib/server/n8n/webhook-auth"
import { supabase } from "@/lib/server/db"
import { queueReminder } from "@/lib/server/services/reminders"

export async function POST(request: Request) {
  const { valid } = await verifyN8nRequest(request)
  if (!valid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 })
  }

  try {
    const now = new Date()
    const nowISO = now.toISOString()

    // Query overdue unassigned instances
    const { data: unassignedOverdue, error: queryError } = await supabase
      .from("inspection_instances")
      .select(
        `
        id,
        due_at,
        location_id,
        inspection_templates(task),
        locations(name)
      `
      )
      .in("status", ["pending", "in_progress"])
      .lt("due_at", nowISO)
      .is("assigned_to_profile_id", null)
      .is("assigned_to_email", null)

    if (queryError) {
      console.error("Query error fetching unassigned overdue:", queryError)
      return Response.json(
        { error: "Failed to fetch instances" },
        { status: 500 }
      )
    }

    const ownerEmail = process.env.OWNER_ESCALATION_EMAIL
    let escalationSent = false

    if (unassignedOverdue && unassignedOverdue.length > 0 && ownerEmail) {
      try {
        const byLocation = unassignedOverdue.reduce((acc, instance) => {
          const task = ((instance as any).inspection_templates as any)?.task ?? "Inspection"
          const locationName = ((instance as any).locations as any)?.name ?? "Unknown Location"

          if (!acc[locationName]) acc[locationName] = []
          acc[locationName].push({
            id: instance.id,
            task,
            due_at: instance.due_at,
          })
          return acc
        }, {} as Record<string, Array<{ id: string; task: string; due_at: string }>>)

        await queueReminder({
          type: "escalation",
          to_email: ownerEmail,
          subject: `Action Required: ${unassignedOverdue.length} unassigned overdue inspection${unassignedOverdue.length > 1 ? "s" : ""}`,
          payload: {
            count: unassignedOverdue.length,
            by_location: byLocation,
            task: `${unassignedOverdue.length} unassigned overdue inspections`,
            due_at: nowISO,
          },
        })
        escalationSent = true
      } catch (err) {
        console.error("Failed to queue escalation email:", err)
      }
    }

    return Response.json({
      escalation_sent: escalationSent,
      unassigned_count: unassignedOverdue?.length ?? 0,
      source: "n8n",
      timestamp: nowISO,
    })
  } catch (error) {
    console.error("n8n webhook escalation error:", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
