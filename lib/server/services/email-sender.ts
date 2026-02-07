import "server-only"
import { resend, FROM_EMAIL } from "@/lib/server/email"
import { ReminderEmail } from "@/emails/reminder-email"
import { InviteEmail } from "@/emails/invite-email"
import { WelcomeEmail } from "@/emails/welcome-email"
import type { NotificationRecord } from "./reminders"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function sendNotificationEmail(
  notification: NotificationRecord
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Resend not configured, skipping email:", notification.id)
    return { success: true } // Don't fail if email not configured
  }

  try {
    const { type, to_email, subject, payload } = notification

    let emailComponent: React.ReactElement

    switch (type) {
      case "reminder":
      case "overdue":
      case "escalation":
      case "due_today":
      case "upcoming":
      case "monthly_warning":
      case "assignment":
        emailComponent = ReminderEmail({
          task: (payload.task as string) || "Inspection",
          dueAt: (payload.due_at as string) || new Date().toISOString(),
          locationName: payload.location_name as string | undefined,
          inspectionUrl: `${APP_URL}/inspections/${payload.instance_id}`,
          type,
        })
        break

      default:
        return { success: false, error: `Unknown notification type: ${type}` }
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to_email,
      subject,
      react: emailComponent,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}

export async function sendInviteEmail(params: {
  to_email: string
  invite_code: string
  location_name: string
  expires_at: string
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Resend not configured, skipping invite email")
    return { success: true }
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to_email,
      subject: `You're invited to ${params.location_name}`,
      react: InviteEmail({
        inviteCode: params.invite_code,
        locationName: params.location_name,
        inviteUrl: `${APP_URL}/invite?code=${params.invite_code}`,
        expiresAt: params.expires_at,
      }),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}

export async function sendWelcomeEmail(params: {
  to_email: string
  full_name: string
  temp_password: string
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Resend not configured, skipping welcome email")
    return { success: true }
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to_email,
      subject: "Welcome to Inspection Tracker",
      react: WelcomeEmail({
        fullName: params.full_name,
        email: params.to_email,
        tempPassword: params.temp_password,
        loginUrl: `${APP_URL}/login`,
      }),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}
