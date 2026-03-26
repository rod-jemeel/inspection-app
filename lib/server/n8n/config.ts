import "server-only"

if (!process.env.N8N_BASE_URL && process.env.NODE_ENV === "production") {
  console.warn("[n8n] N8N_BASE_URL is not set — webhook calls will target localhost and fail in production.")
}
if (!process.env.N8N_WEBHOOK_SECRET && process.env.NODE_ENV === "production") {
  console.warn("[n8n] N8N_WEBHOOK_SECRET is not set — webhook signature verification will be skipped.")
}

export const n8nConfig = {
  /** Base URL of n8n instance */
  baseUrl: process.env.N8N_BASE_URL || "http://localhost:5678",
  /** Shared secret for HMAC-SHA256 webhook signatures */
  webhookSecret: process.env.N8N_WEBHOOK_SECRET || "",
  /** Whether shadow mode is active (run n8n parallel to Vercel cron) */
  shadowMode: process.env.N8N_SHADOW_MODE === "true",
  /** Webhook paths on n8n side */
  webhooks: {
    assignmentChanged: "/webhook/assignment-changed",
    inspectionCompleted: "/webhook/inspection-completed",
    formResponseSubmitted: "/webhook/form-response-submitted",
    formResponseCorrected: "/webhook/form-response-corrected",
  },
}
