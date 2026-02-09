import { n8nConfig } from "@/lib/server/n8n/config"

export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    shadow_mode: n8nConfig.shadowMode,
  })
}
