import "server-only"
import { NextRequest } from "next/server"
import { supabase } from "@/lib/server/db"
import { calculateNextDueDate } from "@/lib/server/services/instances"

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 1. Fetch all active templates with binder_id
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
        timestamp: new Date().toISOString(),
      })
    }

    // 2. Pre-fetch binder assignments for all binders that templates reference
    const binderIds = [...new Set(templates.map(t => t.binder_id).filter(Boolean))]
    const assignmentMap = new Map<string, string>() // binder_id -> first assigned profile_id

    if (binderIds.length > 0) {
      const { data: assignments } = await supabase
        .from("binder_assignments")
        .select("binder_id, profile_id")
        .in("binder_id", binderIds)
        .order("assigned_at", { ascending: true })

      if (assignments) {
        // For each binder, pick the first assigned user (round-robin could be added later)
        for (const a of assignments) {
          if (!assignmentMap.has(a.binder_id)) {
            assignmentMap.set(a.binder_id, a.profile_id)
          }
        }
      }
    }

    // 3. For each template, check if there's already a pending/in_progress instance
    const results = await Promise.allSettled(
      templates.map(async (template) => {
        // Check if there's already a pending or in_progress instance for this template
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

        // If there's already a pending/in_progress instance, skip
        if (existingInstances && existingInstances.length > 0) {
          return { status: "skipped" as const, templateId: template.id }
        }

        // Generate the next instance
        const dueDate = calculateNextDueDate(template.frequency)

        // Determine assignee: template default > binder assignment > null
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
            created_by: "system", // System-generated instance
          })

        if (insertError) {
          console.error(`Error creating instance for template ${template.id}:`, insertError)
          return { status: "error" as const, templateId: template.id }
        }

        return { status: "generated" as const, templateId: template.id }
      })
    )

    // 4. Aggregate results
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
        // Promise rejected
        console.error("Instance generation promise rejected:", result.reason)
        errors++
      }
    }

    return Response.json({
      generated,
      skipped,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron generate-instances error:", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
