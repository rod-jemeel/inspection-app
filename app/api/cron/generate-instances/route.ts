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
    // 1. Fetch all scheduling-active form templates (excluding as_needed)
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
        timestamp: new Date().toISOString(),
      })
    }

    // 2. Pre-fetch binder assignments for all binders that forms reference
    const binderIds = [...new Set(forms.map(f => f.binder_id).filter(Boolean))]
    const assignmentMap = new Map<string, string>() // binder_id -> first assigned profile_id

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

    // 3. For each form, check if there's already a pending/in_progress instance
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

        // Generate the next instance
        const dueDate = calculateNextDueDate(form.frequency as "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years", undefined, form.default_due_rule)

        // Determine assignee: form default > binder assignment > null
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
          console.error(`Error creating instance for form ${form.id}:`, insertError)
          return { status: "error" as const, formId: form.id }
        }

        return { status: "generated" as const, formId: form.id }
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
