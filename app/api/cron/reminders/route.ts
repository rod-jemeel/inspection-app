import "server-only"
import { NextRequest } from "next/server"
import { supabase } from "@/lib/server/db"
import {
  queueReminder,
  processQueuedNotifications,
  markNotificationSent,
  markNotificationFailed,
} from "@/lib/server/services/reminders"
import { sendNotificationEmail } from "@/lib/server/services/email-sender"
import { sendPushToProfile } from "@/lib/server/services/push-sender"

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date().toISOString()

    // 1. Find overdue inspections and queue notifications
    const { data: overdueInstances, error: queryError } = await supabase
      .from("inspection_instances")
      .select(
        `
        id,
        due_at,
        assigned_to_email,
        assigned_to_profile_id,
        location_id,
        inspection_templates(task),
        locations(name)
      `
      )
      .in("status", ["pending", "in_progress"])
      .lt("due_at", now)
      .limit(100)

    if (queryError) {
      console.error("Query error fetching overdue instances:", queryError)
      return Response.json(
        { error: "Failed to fetch overdue instances" },
        { status: 500 }
      )
    }

    // Prepare data for parallel processing
    const instancesWithMeta = (overdueInstances ?? []).map((instance) => {
      const task =
        ((instance as any).inspection_templates as any)?.task ?? "Inspection"
      const locationName =
        ((instance as any).locations as any)?.name ?? undefined
      return { instance, task, locationName }
    })

    // Build push notification promises (parallel)
    const pushPromises = instancesWithMeta
      .filter(({ instance }) => instance.assigned_to_profile_id)
      .map(({ instance, task, locationName }) =>
        sendPushToProfile(instance.assigned_to_profile_id!, {
          title: "Overdue Inspection",
          body: `${task} at ${locationName || "your location"} is overdue`,
          url: `/inspections/${instance.id}`,
          tag: `overdue-${instance.id}`,
          actions: [
            { action: "view", title: "View" },
            { action: "dismiss", title: "Dismiss" },
          ],
        }).catch((err) => {
          console.error(`Failed to send push for instance ${instance.id}:`, err)
          return { sent: 0, failed: 1 }
        })
      )

    // Build email queue promises (parallel)
    const queuePromises = instancesWithMeta
      .filter(({ instance }) => instance.assigned_to_email)
      .map(({ instance, task, locationName }) =>
        queueReminder({
          type: "overdue",
          to_email: instance.assigned_to_email!,
          subject: `Overdue: ${task}`,
          payload: {
            instance_id: instance.id,
            location_id: instance.location_id,
            location_name: locationName,
            task,
            due_at: instance.due_at,
          },
        }).catch((err) => {
          console.error(`Failed to queue reminder for instance ${instance.id}:`, err)
          return null
        })
      )

    // Execute all push and queue operations in parallel
    const [pushResults, queueResults] = await Promise.all([
      Promise.all(pushPromises),
      Promise.all(queuePromises),
    ])

    // Aggregate results
    const pushSent = pushResults.reduce((sum, r) => sum + r.sent, 0)
    const pushFailed = pushResults.reduce((sum, r) => sum + r.failed, 0)
    const queued = queueResults.filter((r) => r !== null).length

    // 2. Process queued notifications (send emails via Resend)
    let pending: Awaited<ReturnType<typeof processQueuedNotifications>> = []
    try {
      pending = await processQueuedNotifications(50)
    } catch (err) {
      console.error("Failed to fetch pending notifications:", err)
      return Response.json(
        { error: "Failed to fetch pending notifications" },
        { status: 500 }
      )
    }

    let sent = 0
    let failed = 0

    for (const notification of pending) {
      const result = await sendNotificationEmail(notification)

      if (result.success) {
        try {
          await markNotificationSent(notification.id)
          sent++
        } catch (err) {
          console.error(
            `Failed to mark notification ${notification.id} as sent:`,
            err
          )
        }
      } else {
        try {
          await markNotificationFailed(
            notification.id,
            result.error || "Unknown error"
          )
        } catch (failErr) {
          console.error(
            `Failed to mark notification ${notification.id} as failed:`,
            failErr
          )
        }
        failed++
      }
    }

    return Response.json({
      queued,
      processed: { sent, failed },
      push: { sent: pushSent, failed: pushFailed },
      timestamp: now,
    })
  } catch (error) {
    console.error("Cron reminders error:", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
