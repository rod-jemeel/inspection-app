import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { getInstance, updateInstance } from "@/lib/server/services/instances"
import { appendEvent } from "@/lib/server/services/events"
import { queueReminder } from "@/lib/server/services/reminders"
import { sendPushToProfile } from "@/lib/server/services/push-sender"
import { notifyAssignmentChanged, notifyInspectionCompleted } from "@/lib/server/n8n/webhook-sender"
import { updateInstanceSchema } from "@/lib/validations/instance"
import { after } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string; instanceId: string }> }
) {
  try {
    const { locationId, instanceId } = await params
    await requireLocationAccess(locationId)

    const instance = await getInstance(locationId, instanceId)
    return Response.json({ data: instance })
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; instanceId: string }> }
) {
  try {
    const { locationId, instanceId } = await params
    const { profile } = await requireLocationAccess(locationId)

    const body = await request.json()
    const parsed = updateInstanceSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.issues).toResponse()
    }

    // AUTHORIZATION: Only admin/owner/nurse can reassign inspections
    const isReassignment =
      parsed.data.assigned_to_profile_id !== undefined ||
      parsed.data.assigned_to_email !== undefined
    if (isReassignment && profile.role === "inspector") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Inspectors cannot reassign inspections" } },
        { status: 403 }
      )
    }

    // Get current instance to check if assignee changed
    const currentInstance = await getInstance(locationId, instanceId)
    const instance = await updateInstance(locationId, instanceId, parsed.data)

    // Send notification on reassignment
    if (isReassignment) {
      const newProfileId = parsed.data.assigned_to_profile_id
      const newEmail = parsed.data.assigned_to_email
      const wasReassigned =
        newProfileId !== currentInstance.assigned_to_profile_id ||
        newEmail !== currentInstance.assigned_to_email

      if (wasReassigned && (newProfileId || newEmail)) {
        after(async () => {
          // Send push notification to new assignee
          if (newProfileId) {
            await sendPushToProfile(newProfileId, {
              title: "New Assignment",
              body: `You've been assigned: ${instance.template_task}`,
              url: `/inspections/${instance.id}`,
              tag: `assignment-${instance.id}`,
            }).catch((err) => console.error("Push notification failed:", err))
          }

          // Queue email to new assignee
          if (newEmail) {
            await queueReminder({
              type: "assignment",
              to_email: newEmail,
              subject: `New Assignment: ${instance.template_task}`,
              payload: {
                instance_id: instance.id,
                task: instance.template_task,
                due_at: instance.due_at,
                location_name: undefined, // Could fetch location name if needed
              },
            }).catch((err) => console.error("Email queue failed:", err))
          }

          // Log reassignment event
          await appendEvent(instance.id, "reassigned", profile.id, {
            assigned_to_profile_id: newProfileId,
            assigned_to_email: newEmail,
          })

          // Notify n8n of assignment change
          await notifyAssignmentChanged({
            event: "assignment_changed",
            timestamp: new Date().toISOString(),
            instance_id: instance.id,
            template_task: instance.template_task ?? "Inspection",
            new_assignee_profile_id: newProfileId || null,
            new_assignee_email: newEmail || null,
            old_assignee_profile_id: currentInstance.assigned_to_profile_id || null,
            location_id: locationId,
          })
        })
      }
    }

    if (parsed.data.status) {
      after(async () => {
        await appendEvent(instance.id, parsed.data.status!, profile.id, {
          remarks: parsed.data.remarks,
        })

        // Notify n8n of inspection completion
        if (["passed", "failed"].includes(parsed.data.status!)) {
          await notifyInspectionCompleted({
            event: "inspection_completed",
            timestamp: new Date().toISOString(),
            instance_id: instance.id,
            template_task: instance.template_task ?? "Inspection",
            status: parsed.data.status!,
            completed_by_profile_id: profile.id,
            location_id: locationId,
          })
        }
      })
    }

    return Response.json({ data: instance })
  } catch (error) {
    return handleError(error)
  }
}
