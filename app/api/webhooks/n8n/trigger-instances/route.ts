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
    // Fetch all scheduling-active form templates (excluding as_needed)
    const { data: forms, error: formsError } = await supabase
      .from("form_templates")
      .select("id, location_id, frequency, default_assignee_profile_id, binder_id, default_due_rule, log_type")
      .eq("scheduling_active", true)
      .eq("active", true)
      .neq("frequency", "as_needed")

    if (formsError) {
      console.error("Query error fetching form templates:", formsError)
      return Response.json(
        { error: "Failed to fetch form templates" },
        { status: 500 }
      )
    }

    if (!forms || forms.length === 0) {
      return Response.json({
        generated: 0,
        skipped: 0,
        errors: 0,
        source: "n8n",
        timestamp: new Date().toISOString(),
      })
    }

    // Pre-fetch binder assignments
    const binderIds = [...new Set(forms.map(f => f.binder_id).filter(Boolean))]
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

    // For each form, check if instance exists
    const results = await Promise.allSettled(
      forms.map(async (form) => {
        const { data: existingInstances, error: checkError } = await supabase
          .from("inspection_instances")
          .select("id, status")
          .eq("form_template_id", form.id)
          .in("status", ["pending", "in_progress"])
          .limit(1)

        if (checkError) {
          console.error(`Error checking instances for form ${form.id}:`, checkError)
          return { status: "error" as const, formId: form.id }
        }

        if (existingInstances && existingInstances.length > 0) {
          return { status: "skipped" as const, formId: form.id }
        }

        const dueDate = calculateNextDueDate(form.frequency as "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years", undefined, form.default_due_rule)

        const assigneeProfileId =
          form.default_assignee_profile_id ||
          (form.binder_id ? assignmentMap.get(form.binder_id) : null) ||
          null

        const { error: insertError } = await supabase
          .from("inspection_instances")
          .insert({
            form_template_id: form.id,
            location_id: form.location_id,
            due_at: dueDate.toISOString(),
            assigned_to_profile_id: assigneeProfileId,
            status: "pending",
            created_by: "system",
            ...(form.log_type ? { log_type: form.log_type } : {}),
          })

        if (insertError) {
          // Unique constraint violation → instance already exists (race with cron)
          if (insertError.code === "23505") {
            return { status: "skipped" as const, formId: form.id }
          }
          console.error(`Error creating instance for form ${form.id}:`, insertError)
          return { status: "error" as const, formId: form.id }
        }

        return { status: "generated" as const, formId: form.id }
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
