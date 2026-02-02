import "server-only"
import webpush from "web-push"
import { supabase } from "@/lib/server/db"

// Configure VAPID details
if (
  process.env.VAPID_SUBJECT &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export interface NotificationPayload {
  title: string
  body: string
  url?: string
  tag?: string
  actions?: { action: string; title: string }[]
}

interface PushSubscription {
  id: string
  profile_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Send push notification to a specific profile
 */
export async function sendPushToProfile(
  profileId: string,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh, auth")
    .eq("profile_id", profileId)

  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0 }
  }

  return sendToSubscriptions(subscriptions as PushSubscription[], payload)
}

/**
 * Send push notification to all profiles in a location
 */
export async function sendPushToLocation(
  locationId: string,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  // Get all profile IDs linked to this location
  const { data: profileLinks } = await supabase
    .from("profile_locations")
    .select("profile_id")
    .eq("location_id", locationId)

  if (!profileLinks?.length) {
    return { sent: 0, failed: 0 }
  }

  const profileIds = profileLinks.map((link) => link.profile_id)

  // Get all subscriptions for those profiles
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh, auth")
    .in("profile_id", profileIds)

  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0 }
  }

  return sendToSubscriptions(subscriptions as PushSubscription[], payload)
}

/**
 * Send push notification to profiles with specific roles in a location
 */
export async function sendPushToRolesInLocation(
  locationId: string,
  roles: string[],
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  // Get profiles with matching roles linked to this location
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      `
      id,
      profile_locations!inner(location_id)
    `
    )
    .eq("profile_locations.location_id", locationId)
    .in("role", roles)

  if (!profiles?.length) {
    return { sent: 0, failed: 0 }
  }

  const profileIds = profiles.map((p) => p.id)

  // Get all subscriptions for those profiles
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh, auth")
    .in("profile_id", profileIds)

  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0 }
  }

  return sendToSubscriptions(subscriptions as PushSubscription[], payload)
}

/**
 * Internal function to send notifications to a list of subscriptions
 */
async function sendToSubscriptions(
  subscriptions: PushSubscription[],
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      )
    )
  )

  // Collect failed/expired subscription endpoints
  const expiredEndpoints: string[] = []

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const error = result.reason
      // 404 or 410 means the subscription is expired or invalid
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        expiredEndpoints.push(subscriptions[index].endpoint)
      } else {
        console.error("Push notification failed:", error)
      }
    }
  })

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints)
  }

  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  }
}
