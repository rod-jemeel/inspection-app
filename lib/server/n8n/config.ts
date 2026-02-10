import "server-only"

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
  },
}
