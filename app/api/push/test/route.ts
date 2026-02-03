import "server-only"
import { requireSession } from "@/lib/server/auth-helpers"
import { sendPushToProfile } from "@/lib/server/services/push-sender"
import { handleError } from "@/lib/server/errors"

/**
 * POST /api/push/test
 * Send a test push notification to the current user
 */
export async function POST() {
  try {
    const { profile } = await requireSession()

    const result = await sendPushToProfile(profile.id, {
      title: "Test Notification",
      body: "Push notifications are working! You'll receive alerts for inspections.",
      url: "/settings",
      tag: "test-notification",
    })

    return Response.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error) {
    return handleError(error)
  }
}
