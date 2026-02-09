import "server-only"
import { n8nConfig } from "./config"
import { createSignedHeaders } from "./webhook-auth"
import type { AssignmentChangedPayload, InspectionCompletedPayload } from "./types"

export async function sendWebhookToN8n(
  path: string,
  payload: object
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const url = `${n8nConfig.baseUrl}${path}`
  const headers = createSignedHeaders(payload)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return {
      success: response.ok,
      statusCode: response.status,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`Failed to send webhook to n8n (${path}):`, errorMessage)

    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function notifyAssignmentChanged(
  data: AssignmentChangedPayload
): Promise<void> {
  if (!n8nConfig.webhookSecret) return

  const result = await sendWebhookToN8n(
    n8nConfig.webhooks.assignmentChanged,
    data
  )

  if (!result.success) {
    console.error("Failed to notify n8n of assignment change:", result.error)
  }
}

export async function notifyInspectionCompleted(
  data: InspectionCompletedPayload
): Promise<void> {
  if (!n8nConfig.webhookSecret) return

  const result = await sendWebhookToN8n(
    n8nConfig.webhooks.inspectionCompleted,
    data
  )

  if (!result.success) {
    console.error("Failed to notify n8n of inspection completion:", result.error)
  }
}
