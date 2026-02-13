import "server-only"
import { verifyN8nRequest } from "@/lib/server/n8n/webhook-auth"
import { supabase } from "@/lib/server/db"
import {
  queueReminder,
  processQueuedNotifications,
  markNotificationSent,
  markNotificationFailed,
} from "@/lib/server/services/reminders"
import { sendNotificationEmail } from "@/lib/server/services/email-sender"
import { sendPushToProfile } from "@/lib/server/services/push-sender"
import { shouldSendReminder, type ReminderConfig } from "@/lib/server/services/instances"
import { CRON_BATCH_LIMIT, NOTIFICATION_BATCH_LIMIT } from "@/lib/constants"

type ReminderType = "overdue" | "due_today" | "upcoming" | "monthly_warning"

function getReminderMessage(type: ReminderType, task: string, locationName?: string): { title: string; body: string } {
  const location = locationName || "your location"
  switch (type) {
    case "overdue":
      return { title: "Overdue Inspection", body: `${task} at ${location} is overdue` }
    case "due_today":
      return { title: "Inspection Due Today", body: `${task} at ${location} is due today` }
    case "upcoming":
      return { title: "Upcoming Inspection", body: `${task} at ${location} is coming up soon` }
    case "monthly_warning":
      return { title: "Inspection Reminder", body: `${task} at ${location} is due soon - monthly reminder` }
  }
}

export async function POST(request: Request) {
  const { valid } = await verifyN8nRequest(request)
  if (!valid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 })
  }

  try {
    const now = new Date()
    const nowISO = now.toISOString()

    // Fetch reminder settings from database
    const { data: settingsRow } = await supabase
      .from("reminder_settings")
      .select("*")
      .limit(1)
      .single()

    const reminderConfig: ReminderConfig = settingsRow ?? {
      weekly_due_day: true,
      monthly_days_before: 7,
      monthly_due_day: true,
      yearly_months_before: 6,
      yearly_monthly_reminder: true,
      yearly_due_day: true,
      three_year_months_before: 6,
      three_year_monthly_reminder: true,
      three_year_due_day: true,
    }

    // Fetch all pending/in_progress inspections
    const sixMonthsFromNow = new Date(now)
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6)

    const { data: allInstances, error: queryError } = await supabase
      .from("inspection_instances")
      .select(
        `
        id,
        due_at,
        assigned_to_email,
        assigned_to_profile_id,
        location_id,
        inspection_templates(task, frequency),
        locations(name)
      `
      )
      .in("status", ["pending", "in_progress"])
      .lte("due_at", sixMonthsFromNow.toISOString())
      .limit(CRON_BATCH_LIMIT)

    if (queryError) {
      console.error("Query error fetching instances:", queryError)
      return Response.json(
        { error: "Failed to fetch instances" },
        { status: 500 }
      )
    }

    // Categorize instances by reminder type
    const instancesWithReminder: Array<{
      instance: typeof allInstances[0]
      task: string
      locationName?: string
      frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years"
      reminderType: ReminderType
    }> = []

    for (const instance of allInstances ?? []) {
      const task = ((instance as any).inspection_templates as any)?.task ?? "Inspection"
      const frequency = ((instance as any).inspection_templates as any)?.frequency as "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "every_3_years" | null
      const locationName = ((instance as any).locations as any)?.name ?? undefined

      if (!frequency) continue

      const dueAt = new Date(instance.due_at)
      const isOverdue = dueAt < now

      if (isOverdue) {
        instancesWithReminder.push({ instance, task, locationName, frequency, reminderType: "overdue" })
      } else {
        const reminderType = shouldSendReminder(dueAt, frequency, reminderConfig)
        if (reminderType) {
          instancesWithReminder.push({ instance, task, locationName, frequency, reminderType })
        }
      }
    }

    // Build push notification promises (parallel)
    const pushPromises = instancesWithReminder
      .filter(({ instance }) => instance.assigned_to_profile_id)
      .map(({ instance, task, locationName, reminderType }) => {
        const { title, body } = getReminderMessage(reminderType, task, locationName)
        return sendPushToProfile(instance.assigned_to_profile_id!, {
          title,
          body,
          url: `/inspections/${instance.id}`,
          tag: `${reminderType}-${instance.id}`,
          actions: [
            { action: "view", title: "View" },
            { action: "dismiss", title: "Dismiss" },
          ],
        }).catch((err) => {
          console.error(`Failed to send push for instance ${instance.id}:`, err)
          return { sent: 0, failed: 1 }
        })
      })

    // Build email queue promises (parallel)
    const queuePromises = instancesWithReminder
      .filter(({ instance }) => instance.assigned_to_email)
      .map(({ instance, task, locationName, reminderType }) => {
        const { title } = getReminderMessage(reminderType, task, locationName)
        return queueReminder({
          type: reminderType,
          to_email: instance.assigned_to_email!,
          subject: title,
          payload: {
            instance_id: instance.id,
            location_id: instance.location_id,
            location_name: locationName,
            task,
            due_at: instance.due_at,
            reminder_type: reminderType,
          },
        }).catch((err) => {
          console.error(`Failed to queue reminder for instance ${instance.id}:`, err)
          return null
        })
      })

    // Execute all push and queue operations in parallel
    const [pushResults, queueResults] = await Promise.all([
      Promise.all(pushPromises),
      Promise.all(queuePromises),
    ])

    // Aggregate results
    const pushSent = pushResults.reduce((sum, r) => sum + r.sent, 0)
    const pushFailed = pushResults.reduce((sum, r) => sum + r.failed, 0)
    const queued = queueResults.filter((r) => r !== null).length

    // Process queued notifications (send emails via Resend)
    let pending: Awaited<ReturnType<typeof processQueuedNotifications>> = []
    try {
      pending = await processQueuedNotifications(NOTIFICATION_BATCH_LIMIT)
    } catch (err) {
      console.error("Failed to fetch pending notifications:", err)
      return Response.json(
        { error: "Failed to fetch pending notifications" },
        { status: 500 }
      )
    }

    // Process notifications in parallel
    const notificationResults = await Promise.allSettled(
      pending.map(async (notification) => {
        const result = await sendNotificationEmail(notification)

        if (result.success) {
          await markNotificationSent(notification.id)
          return { status: "sent" as const }
        } else {
          await markNotificationFailed(
            notification.id,
            result.error || "Unknown error"
          )
          return { status: "failed" as const }
        }
      })
    )

    // Aggregate notification results
    let sent = 0
    let failed = 0
    for (const result of notificationResults) {
      if (result.status === "fulfilled") {
        if (result.value.status === "sent") {
          sent++
        } else {
          failed++
        }
      } else {
        console.error("Notification processing error:", result.reason)
        failed++
      }
    }

    // Count reminders by type
    const reminderCounts = instancesWithReminder.reduce((acc, { reminderType }) => {
      acc[reminderType] = (acc[reminderType] || 0) + 1
      return acc
    }, {} as Record<ReminderType, number>)

    // Send daily digest for unassigned overdue inspections
    let escalationSent = false
    const unassignedOverdue = instancesWithReminder.filter(
      ({ instance, reminderType }) =>
        !instance.assigned_to_email &&
        !instance.assigned_to_profile_id &&
        reminderType === "overdue"
    )

    const ownerEmail = process.env.OWNER_ESCALATION_EMAIL
    if (unassignedOverdue.length > 0 && ownerEmail) {
      try {
        const byLocation = unassignedOverdue.reduce((acc, { instance, task, locationName }) => {
          const loc = locationName || "Unknown Location"
          if (!acc[loc]) acc[loc] = []
          acc[loc].push({ id: instance.id, task, due_at: instance.due_at })
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
      queued,
      processed: { sent, failed },
      push: { sent: pushSent, failed: pushFailed },
      reminders: reminderCounts,
      escalation: { sent: escalationSent, unassignedCount: unassignedOverdue.length },
      source: "n8n",
      timestamp: nowISO,
    })
  } catch (error) {
    console.error("n8n webhook reminders error:", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
