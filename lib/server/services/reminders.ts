import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"

export type NotificationType =
  | "reminder"
  | "overdue"
  | "escalation"
  | "due_today"
  | "upcoming"
  | "monthly_warning"

export interface NotificationRecord {
  id: string
  type: NotificationType
  to_email: string
  subject: string
  payload: Record<string, unknown>
  status: "queued" | "sent" | "failed"
  created_at: string
  sent_at: string | null
  error: string | null
}

export async function queueReminder(input: {
  type: NotificationType
  to_email: string
  subject: string
  payload: Record<string, unknown>
}) {
  const { data, error } = await supabase
    .from("notification_outbox")
    .insert({
      type: input.type,
      to_email: input.to_email,
      subject: input.subject,
      payload: input.payload,
      status: "queued",
    })
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as NotificationRecord
}

export async function processQueuedNotifications(limit = 50) {
  const { data: queued, error } = await supabase
    .from("notification_outbox")
    .select("id, type, to_email, subject, payload, status, created_at, sent_at, error")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return (queued ?? []) as NotificationRecord[]
}

export async function markNotificationSent(id: string) {
  await supabase
    .from("notification_outbox")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
}

export async function markNotificationFailed(id: string, errorMsg: string) {
  await supabase
    .from("notification_outbox")
    .update({ status: "failed", error: errorMsg })
    .eq("id", id)
}
