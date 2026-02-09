import "server-only"
import { verifyN8nRequest } from "@/lib/server/n8n/webhook-auth"
import { supabase } from "@/lib/server/db"
import { calculateNextDueDate } from "@/lib/server/services/instances"

export async function POST(request: Request) {
  const { valid } = await verifyN8nRequest(request)
  if (!valid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 })
  }

  try {
    // Fetch all active templates with binder_id
    const { data: templates, error: templatesError } = await supabase
      .from("inspection_templates")
      .select("id, location_id, frequency, default_assignee_profile_id, binder_id")
      .eq("active", true)

    if (templatesError) {
      console.error("Query error fetching templates:", templatesError)
      return Response.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      )
    }

    if (!templates || templates.length === 0) {
      return Response.json({
        generated: 0,
        skipped: 0,
        errors: 0,
        source: "n8n",
        timestamp: new Date().toISOString(),
      })
    }

    // Pre-fetch binder assignments
    const binderIds = [...new Set(templates.map(t => t.binder_id).filter(Boolean))]
    const assignmentMap = new Map<string, string>()

    if (binderIds.length > 0) {
      const { data: assignments } = await supabase
        .from("binder_assignments")
        .select("binder_id, profile_id")
        .in("binder_id", binderIds)
        .order("assigned_at", { ascending: true })

      if (assignments) {
        for (const a of assignments) {
          if (!assignmentMap.has(a.binder_id)) {
            assignmentMap.set(a.binder_id, a.profile_id)
          }
        }
      }
    }

    // For each template, check if instance exists
    const results = await Promise.allSettled(
      templates.map(async (template) => {
        const { data: existingInstances, error: checkError } = await supabase
          .from("inspection_instances")
          .select("id, status")
          .eq("template_id", template.id)
          .in("status", ["pending", "in_progress"])
          .limit(1)

        if (checkError) {
          console.error(`Error checking instances for template ${template.id}:`, checkError)
          return { status: "error" as const, templateId: template.id }
        }

        if (existingInstances && existingInstances.length > 0) {
          return { status: "skipped" as const, templateId: template.id }
        }

        const dueDate = calculateNextDueDate(template.frequency)

        const assigneeProfileId =
          template.default_assignee_profile_id ||
          (template.binder_id ? assignmentMap.get(template.binder_id) : null) ||
          null

        const { error: insertError } = await supabase
          .from("inspection_instances")
          .insert({
            template_id: template.id,
            location_id: template.location_id,
            due_at: dueDate.toISOString(),
            assigned_to_profile_id: assigneeProfileId,
            status: "pending",
            created_by: "system",
          })

        if (insertError) {
          console.error(`Error creating instance for template ${template.id}:`, insertError)
          return { status: "error" as const, templateId: template.id }
        }

        return { status: "generated" as const, templateId: template.id }
      })
    )

    let generated = 0
    let skipped = 0
    let errors = 0

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.status === "generated") {
          generated++
        } else if (result.value.status === "skipped") {
          skipped++
        } else {
          errors++
        }
      } else {
        console.error("Instance generation promise rejected:", result.reason)
        errors++
      }
    }

    return Response.json({
      generated,
      skipped,
      errors,
      source: "n8n",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("n8n webhook generate-instances error:", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
