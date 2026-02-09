import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { n8nConfig } from "./config"

export function signWebhook(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

export function verifyWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = signWebhook(payload, secret)

  if (signature.length !== expectedSignature.length) {
    return false
  }

  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    )
  } catch {
    return false
  }
}

export function createSignedHeaders(body: object): HeadersInit {
  const bodyString = JSON.stringify(body)
  const signature = signWebhook(bodyString, n8nConfig.webhookSecret)

  return {
    "Content-Type": "application/json",
    "X-N8N-Signature": signature,
  }
}

export async function verifyN8nRequest(
  request: Request
): Promise<{ valid: boolean; body: unknown }> {
  try {
    const signature = request.headers.get("X-N8N-Signature")
    if (!signature) {
      return { valid: false, body: null }
    }

    const bodyText = await request.text()
    const valid = verifyWebhook(bodyText, signature, n8nConfig.webhookSecret)

    if (!valid) {
      return { valid: false, body: null }
    }

    const body = JSON.parse(bodyText)
    return { valid: true, body }
  } catch (error) {
    console.error("Error verifying n8n request:", error)
    return { valid: false, body: null }
  }
}
